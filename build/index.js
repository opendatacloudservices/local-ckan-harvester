"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePackages = exports.handleInstance = void 0;
const index_1 = require("./ckan/index");
const index_2 = require("./postgres/index");
const dotenv = require("dotenv");
const path = require("path");
const pg_1 = require("pg");
// get environmental variables
dotenv.config({ path: path.join(__dirname, '../.env') });
const local_microservice_1 = require("local-microservice");
// TODO: Error logging and process logging
// connect to postgres (via env vars params)
const client = new pg_1.Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();
exports.handleInstance = async (client, req, res, next) => {
    return index_2.getInstance(client, req.params.identifier)
        .then(ckanInstance => {
        next(ckanInstance);
    })
        .catch(err => {
        if (err.message === 'Instance not found.') {
            res.status(404).json({ message: 'Instance not found' });
        }
        else {
            res.status(500).json({ error: err.message });
            throw err;
        }
    });
};
exports.handlePackages = async (list, ckanInstance) => {
    for (let i = 0; i < list.result.length; i += 1) {
        await index_1.packageShow(ckanInstance.domain, ckanInstance.version, list.result[i]).then(async (ckanPackage) => {
            return index_2.processPackage(client, ckanInstance.prefix, ckanPackage);
        });
    }
};
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
    exports.handleInstance(client, req, res, ckanInstance => {
        return index_1.packageList(ckanInstance.domain, ckanInstance.version).then(list => exports.handlePackages(list, ckanInstance));
    }).catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
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
    index_2.allInstances(client)
        .then(instanceIds => {
        return Promise.all(instanceIds.map(identifier => {
            return index_2.getInstance(client, identifier).then(ckanInstance => {
                return index_1.packageList(ckanInstance.domain, ckanInstance.version).then(list => exports.handlePackages(list, ckanInstance));
            });
        }));
    })
        .then(() => {
        res.status(200).json({ message: 'Processing completed' });
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
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
    if (!('prefix' in req.params) ||
        !('domain' in req.params) ||
        !('version' in req.params)) {
        const err = Error('Missing parameter: prefix: string, domain: string and version: number are required parameters!');
        res.status(500).json({ error: err.message });
        throw err;
    }
    else {
        index_2.initTables(client, req.params.prefix, req.params.domain, parseInt(req.params.version), req.route.query.filter || null)
            .then(() => {
            res.status(200).json({ message: 'Init completed' });
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            throw err;
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
    exports.handleInstance(client, req, res, ckanInstance => {
        return index_2.resetTables(client, ckanInstance.prefix).then(() => {
            res.status(200).json({ message: 'Reset completed' });
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
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
    exports.handleInstance(client, req, res, ckanInstance => {
        return index_2.dropTables(client, ckanInstance.prefix).then(() => {
            res.status(200).json({ message: 'Drop completed' });
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
    });
});
// API to init/clear database
local_microservice_1.catchAll();
//# sourceMappingURL=index.js.map