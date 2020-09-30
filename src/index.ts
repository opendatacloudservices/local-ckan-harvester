import {packageList} from './ckan/index';
import {
  allInstances,
  initTables,
  resetTables,
  dropTables,
  getInstance,
  handlePackages,
  handleInstance,
  initMasterTable,
  dropMasterTable,
} from './postgres/index';
import * as dotenv from 'dotenv';
import * as path from 'path';
import {Client} from 'pg';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {
  api,
  catchAll,
  logError,
  startTransaction,
  startSpan,
} from 'local-microservice';

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();

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
 * /process/{identifier}:
 *   get:
 *     operationId: getProcess
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
api.get('/process/:identifier', (req, res) => {
  const trans = startTransaction({name: '/process/:identifier', type: 'get'});
  handleInstance(client, req, res, ckanInstance => {
    const span = startSpan({
      name: 'packageList',
      options: {childOf: trans.id()},
    });
    return packageList(ckanInstance.domain, ckanInstance.version).then(list => {
      span.end();
      // do not run this in parallel, in order to not get banned as a harvester!
      return handlePackages(client, list, ckanInstance);
    });
  })
    .then(() => {
      trans.end('success');
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
      trans.end('error');
    });
});

/**
 * @swagger
 *
 * /process_all:
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
api.get('/process_all', (req, res) => {
  const trans = startTransaction({name: '/process_all', type: 'get'});
  allInstances(client)
    .then(instanceIds => {
      return Promise.all(
        instanceIds.map(identifier => {
          // TODO: do individual endpoint calls for performance increase (cluster)
          return getInstance(client, identifier).then(ckanInstance => {
            const span = startSpan({
              name: 'packageList',
              options: {childOf: trans.id()},
            });
            return packageList(ckanInstance.domain, ckanInstance.version).then(
              list => {
                span.end();
                return handlePackages(client, list, ckanInstance);
              }
            );
          });
        })
      );
    })
    .then(() => {
      res.status(200).json({message: 'Processing completed'});
      trans.end('success');
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
      trans.end('error');
    });
});

/**
 * @swagger
 *
 * /init/{domain}/{prefix}/{version}:
 *   get:
 *     operationId: getInit
 *     description: Initialize a new ckan instance
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: domain
 *         description: Domain of the new instance, domain needs to include /api/.../ everything before /action/...
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: prefix
 *         description: Prefix used in the domain
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: version
 *         description: CKAN version either 1 and 3 are currently supported
 *         in: path
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
api.get('/init/:domain/:prefix', (req, res) => {
  const trans = startTransaction({name: '/init/:domain/:prefix', type: 'get'});
  if (
    !('prefix' in req.params) ||
    !('domain' in req.params) ||
    !('version' in req.params)
  ) {
    const err = Error(
      'Missing parameter: prefix: string, domain: string and version: number are required parameters!'
    );
    res.status(500).json({error: err.message});
    trans.end('error');
    logError(err);
  } else {
    initTables(
      client,
      req.params.prefix,
      req.params.domain,
      parseInt(req.params.version),
      req.route.query.filter || null
    )
      .then(() => {
        res.status(200).json({message: 'Init completed'});
        trans.end('success');
      })
      .catch(err => {
        res.status(500).json({error: err.message});
        logError(err);
        trans.end('error');
      });
  }
});

/**
 * @swagger
 *
 * /reset/{identifier}:
 *   get:
 *     operationId: getReset
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
api.get('/reset/:identifier', (req, res) => {
  const trans = startTransaction({name: '/reset/:identifier', type: 'get'});
  handleInstance(client, req, res, ckanInstance => {
    return resetTables(client, ckanInstance.prefix);
  })
    .then(() => {
      res.status(200).json({message: 'Reset completed'});
      trans.end('success');
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
      trans.end('error');
    });
});

/**
 * @swagger
 *
 * /drop/{identifier}:
 *   get:
 *     operationId: getDrop
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
api.get('/drop/:identifier', (req, res) => {
  const trans = startTransaction({name: '/drop/:identifier', type: 'get'});
  handleInstance(client, req, res, ckanInstance => {
    return dropTables(client, ckanInstance.prefix);
  })
    .then(() => {
      res.status(200).json({message: 'Drop completed'});
      trans.end('success');
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
      trans.end('error');
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
  const trans = startTransaction({name: '/master/init', type: 'get'});
  initMasterTable(client)
    .then(() => {
      res.status(200).json({message: 'Init completed'});
      trans.end('success');
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
      trans.end('error');
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
  const trans = startTransaction({name: '/master/drop', type: 'get'});
  dropMasterTable(client)
    .then(() => {
      res.status(200).json({message: 'Drop completed'});
      trans.end('success');
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      logError(err);
      trans.end('error');
    });
});

catchAll();
