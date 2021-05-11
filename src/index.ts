import {packageList, packageShow, CkanPackage} from './ckan/index';
import {
  allInstances,
  processPackage,
  initTables,
  resetTables,
  dropTables,
  getInstance,
  initMasterTable,
  dropMasterTable,
  definition_logs_table,
  handleInstanceError,
} from './postgres/index';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {Client} from 'pg';
import fetch from 'node-fetch';
import * as pm2 from 'local-pm2-config';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {api, catchAll, simpleResponse} from 'local-microservice';

import {logError, startTransaction, localTokens} from 'local-logger';

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();

// number of parallel processes
let processCount = 1;
pm2.apps.forEach(app => {
  if (app.name === 'local-ckan-harvester') {
    processCount = app.max;
  }
});

/**
 * @swagger
 *
 * components:
 *   parameters:
 *     identifier:
 *       name: identifier
 *       description: prefix (string) or ID (integer) of ckan instance.
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *   responses:
 *     500:
 *       description: error
 */

/**
 * @swagger
 *
 * /process/instance/{identifier}:
 *   get:
 *     operationId: getProcessInstance
 *     description: Start the processing of a ckan instance
 *     produces:
 *       - application/json
 *     parameters:
 *       - $ref: '#/components/parameters/identifier'
 *     responses:
 *       200:
 *         description: process completed
 *       500:
 *         $ref: '#/components/responses/500'
 */
api.get('/process/instance/:identifier', (req, res) => {
  getInstance(client, req.params.identifier)
    .then(ckanInstance => {
      const trans = startTransaction({
        name: 'packageList',
        ...localTokens(res),
      });
      return packageList(ckanInstance.domain, ckanInstance.version).then(
        async list => {
          simpleResponse(200, 'Processing completed', res, trans);
          // number of parallel calls per process
          let parallelCount = 3 * processCount;
          if (ckanInstance.rate_limit !== null && ckanInstance.rate_limit > 0) {
            parallelCount = ckanInstance.rate_limit;
          }
          for (let i = 0; i < list.result.length; i += parallelCount) {
            const fetchs = [];
            for (let j = i; j < i + parallelCount; j += 1) {
              fetchs.push(
                fetch(
                  `http://localhost:${process.env.PORT}/process/package/${req.params.identifier}/${list.result[j]}`
                )
              );
            }
            await Promise.all(fetchs);
          }
          trans(true, 'Parallel package processing completed');
          return Promise.resolve();
        }
      );
    })
    .catch(err => {
      handleInstanceError(res, req, err);
    });
});

/**
 * @swagger
 *
 * /process/package/{identifier}/{id}:
 *   get:
 *     operationId: getProcessPackage
 *     description: Start the processing of a ckan instance's package
 *     produces:
 *       - application/json
 *     parameters:
 *       - $ref: '#/components/parameters/identifier'
 *       - name: id
 *         description: id of ckan package for url request
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: process completed
 *       500:
 *         $ref: '#/components/responses/500'
 */
api.get('/process/package/:identifier/:id', (req, res) => {
  getInstance(client, req.params.identifier)
    .then(ckanInstance => {
      const trans = startTransaction({
        name: 'packageShow',
        ...localTokens(res),
      });

      return packageShow(
        ckanInstance.domain,
        ckanInstance.version,
        req.params.id
      )
        .then((ckanPackage: CkanPackage) => {
          trans(true, 'packageShow complete');
          return processPackage(client, ckanInstance.prefix, ckanPackage);
        })
        .then(log => {
          trans(true, 'processPackage complete');
          client.query(
            `INSERT INTO ${definition_logs_table}
            (instance, process, package, status, date)
          VALUES
            ($1, $2, $3, $4, CURRENT_TIMESTAMP);
          `,
            [ckanInstance.id, '/process/package', log.id, log.status]
          );
        });
    })
    .then(() => {
      res.status(200).json({message: 'Processing completed'});
    })
    .catch(err => {
      handleInstanceError(res, req, err);
    });
});

/**
 * @swagger
 *
 * /process/all:
 *   get:
 *     operationId: getProcessAll
 *     description: Start the processing of all ckan instance
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       200:
 *         description: processes initiated
 *       500:
 *         $ref: '#/components/responses/500'
 */
api.get('/process/all', (req, res) => {
  allInstances(client)
    .then(instanceIds => {
      return Promise.all(
        instanceIds.map(identifier => {
          return getInstance(client, identifier).then(ckanInstance =>
            fetch(
              `http://localhost:${process.env.PORT}/process/instance/${ckanInstance.id}`
            )
          );
        })
      );
    })
    .then(() => {
      res.status(200).json({message: 'Processing completed'});
    })
    .catch(err => {
      handleInstanceError(res, req, err);
    });
});

/**
 * @swagger
 *
 * /instance/init:
 *   get:
 *     operationId: getInstanceInit
 *     description: Initialize a new ckan instance
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: domain
 *         description: Domain of the new instance, domain needs to include /api/.../ everything before /action/...
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: prefix
 *         description: Prefix used in the domain
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: version
 *         description: CKAN version either 1 and 3 are currently supported
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *       - name: filter
 *         description: An object which is applied agains each imported object as a filter.
 *         in: query
 *         required: false
 *         schema:
 *           type: object
 *     responses:
 *       200:
 *         description: Init completed
 *       500:
 *         $ref: '#/components/responses/500'
 */
api.get('/instance/init', (req, res) => {
  if (
    !('prefix' in req.query) ||
    !('domain' in req.query) ||
    !('version' in req.query)
  ) {
    const err = Error(
      'Missing parameter: prefix: string, domain: string and version: number are required parameters!'
    );
    logError({
      ...localTokens(res),
      err,
    });
    res.status(500).json({error: err.message});
  } else {
    initTables(
      client,
      (req.query.prefix || 'undefined').toString(),
      (req.query.domain || 'undefined').toString(),
      parseInt((req.query.version || '3').toString()),
      !req.query.rate_limit ? 0 : parseInt(req.query.rate_limit.toString()),
      !req.query.filter ? null : req.query.filter.toString()
    )
      .then(() => {
        res.status(200).json({message: 'Init completed'});
      })
      .catch(err => {
        handleInstanceError(res, req, err);
      });
  }
});

/**
 * @swagger
 *
 * /instance/reset/{identifier}:
 *   get:
 *     operationId: getInstanceReset
 *     description: Reset all tables of a ckan instance
 *     produces:
 *       - application/json
 *     parameters:
 *       - $ref: '#/components/parameters/identifier'
 *     responses:
 *       500:
 *         $ref: '#/components/responses/500'
 *       200:
 *         description: Reset completed
 */
api.get('/instance/reset/:identifier', (req, res) => {
  getInstance(client, req.params.identifier)
    .then(ckanInstance => {
      return resetTables(client, ckanInstance.prefix);
    })
    .then(() => {
      res.status(200).json({message: 'Reset completed'});
    })
    .catch(err => {
      handleInstanceError(res, req, err);
    });
});

/**
 * @swagger
 *
 * /instance/drop/{identifier}:
 *   get:
 *     operationId: getInstanceDrop
 *     description: Drop all tables of a ckan instance
 *     produces:
 *       - application/json
 *     parameters:
 *       - $ref: '#/components/parameters/identifier'
 *     responses:
 *       500:
 *         $ref: '#/components/responses/500'
 *       200:
 *         description: Drop completed
 */
api.get('/instance/drop/:identifier', (req, res) => {
  getInstance(client, req.params.identifier)
    .then(ckanInstance => {
      return dropTables(client, ckanInstance.prefix);
    })
    .then(() => {
      res.status(200).json({message: 'Drop completed'});
    })
    .catch(err => {
      handleInstanceError(res, req, err);
    });
});

/**
 * @swagger
 *
 * /master/init:
 *   get:
 *     operationId: getMasterInit
 *     description: Inititate the ckan management tables
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       500:
 *         $ref: '#/components/responses/500'
 *       200:
 *         description: Init completed
 */
api.get('/master/init', (req, res) => {
  initMasterTable(client)
    .then(() => {
      res.status(200).json({message: 'Init completed'});
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
    });
});

/**
 * @swagger
 *
 * /master/drop:
 *   get:
 *     operationId: getMasterDrop
 *     description: Drop the ckan management tables
 *     produces:
 *       - application/json
 *     parameters:
 *     responses:
 *       500:
 *         $ref: '#/components/responses/500'
 *       200:
 *         description: Drop completed
 */
api.get('/master/drop', (req, res) => {
  dropMasterTable(client)
    .then(() => {
      res.status(200).json({message: 'Drop completed'});
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
    });
});

catchAll();
