"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./ckan/index");
const index_2 = require("./postgres/index");
const dotenv = require("dotenv");
const path = require("path");
const pg_1 = require("pg");
// get environmental variables
dotenv.config({ path: path.join(__dirname, '../.env') });
const local_microservice_1 = require("local-microservice");
// connect to postgres (via env vars params)
const client = new pg_1.Client({
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
local_microservice_1.api.get('/process/:identifier', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/process/:identifier', type: 'get' });
    index_2.handleInstance(client, req, res, ckanInstance => {
        const span = local_microservice_1.startSpan({
            name: 'packageList',
            options: { childOf: trans.id() },
        });
        return index_1.packageList(ckanInstance.domain, ckanInstance.version).then(list => {
            span.end();
            // do not run this in parallel, in order to not get banned as a harvester!
            return index_2.handlePackages(client, list, ckanInstance);
        });
    })
        .then(() => {
        trans.end('success');
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        local_microservice_1.logError(err);
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
local_microservice_1.api.get('/process_all', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/process_all', type: 'get' });
    index_2.allInstances(client)
        .then(instanceIds => {
        return Promise.all(instanceIds.map(identifier => {
            // TODO: do individual endpoint calls for performance increase (cluster)
            return index_2.getInstance(client, identifier).then(ckanInstance => {
                const span = local_microservice_1.startSpan({
                    name: 'packageList',
                    options: { childOf: trans.id() },
                });
                return index_1.packageList(ckanInstance.domain, ckanInstance.version).then(list => {
                    span.end();
                    return index_2.handlePackages(client, list, ckanInstance);
                });
            });
        }));
    })
        .then(() => {
        res.status(200).json({ message: 'Processing completed' });
        trans.end('success');
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        local_microservice_1.logError(err);
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
local_microservice_1.api.get('/init/:domain/:prefix', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/init/:domain/:prefix', type: 'get' });
    if (!('prefix' in req.params) ||
        !('domain' in req.params) ||
        !('version' in req.params)) {
        const err = Error('Missing parameter: prefix: string, domain: string and version: number are required parameters!');
        res.status(500).json({ error: err.message });
        trans.end('error');
        local_microservice_1.logError(err);
    }
    else {
        index_2.initTables(client, req.params.prefix, req.params.domain, parseInt(req.params.version), req.route.query.filter || null)
            .then(() => {
            res.status(200).json({ message: 'Init completed' });
            trans.end('success');
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            local_microservice_1.logError(err);
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
local_microservice_1.api.get('/reset/:identifier', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/reset/:identifier', type: 'get' });
    index_2.handleInstance(client, req, res, ckanInstance => {
        return index_2.resetTables(client, ckanInstance.prefix);
    })
        .then(() => {
        res.status(200).json({ message: 'Reset completed' });
        trans.end('success');
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        local_microservice_1.logError(err);
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
local_microservice_1.api.get('/drop/:identifier', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/drop/:identifier', type: 'get' });
    index_2.handleInstance(client, req, res, ckanInstance => {
        return index_2.dropTables(client, ckanInstance.prefix);
    })
        .then(() => {
        res.status(200).json({ message: 'Drop completed' });
        trans.end('success');
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        local_microservice_1.logError(err);
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
local_microservice_1.api.get('/master/init', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/master/init', type: 'get' });
    index_2.initMasterTable(client)
        .then(() => {
        res.status(200).json({ message: 'Init completed' });
        trans.end('success');
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        local_microservice_1.logError(err);
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
local_microservice_1.api.get('/master/drop', (req, res) => {
    const trans = local_microservice_1.startTransaction({ name: '/master/drop', type: 'get' });
    index_2.dropMasterTable(client)
        .then(() => {
        res.status(200).json({ message: 'Drop completed' });
        trans.end('success');
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        local_microservice_1.logError(err);
        trans.end('error');
    });
});
local_microservice_1.catchAll();
//# sourceMappingURL=index.js.map