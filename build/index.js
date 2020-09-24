"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInstance = void 0;
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
local_microservice_1.api.get('/process/:identifier', (req, res) => {
    exports.handleInstance(client, req, res, ckanInstance => {
        return index_1.packageList(ckanInstance.domain)
            .then(async (list) => {
            for (let i = 0; i < list.result.length; i += 1) {
                await index_1.packageShow(ckanInstance.domain, list.result[i]).then(async (ckanPackage) => {
                    return index_2.processPackage(client, ckanInstance.prefix, ckanPackage);
                });
            }
            res.status(200).json({ message: 'Process completed' });
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            throw err;
        });
    });
});
local_microservice_1.api.get('/init/:domain/:prefix', (req, res) => {
    index_2.initTables(client, req.params.prefix, req.params.domain, req.route.query.filter || null)
        .then(() => {
        res.status(200).json({ message: 'Init completed' });
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
    });
});
local_microservice_1.api.get('/reset/:identifier', (req, res) => {
    exports.handleInstance(client, req, res, ckanInstance => {
        return index_2.resetTables(client, ckanInstance.prefix)
            .then(() => {
            res.status(200).json({ message: 'Reset completed' });
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            throw err;
        });
    });
});
local_microservice_1.api.get('/drop/:identifier', (req, res) => {
    exports.handleInstance(client, req, res, ckanInstance => {
        return index_2.dropTables(client, ckanInstance.prefix)
            .then(() => {
            res.status(200).json({ message: 'Drop completed' });
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            throw err;
        });
    });
});
local_microservice_1.catchAll();
//# sourceMappingURL=index.js.map