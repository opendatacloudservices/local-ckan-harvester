"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./ckan/index");
const index_2 = require("./postgres/index");
const dotenv = require("dotenv");
const pg_1 = require("pg");
// get environmental variables
// TODO: Error logging and process logging
dotenv.config();
const local_microservice_1 = require("local-microservice");
// connect to postgres (via env vars params)
const client = new pg_1.Client();
client.connect();
const handleInstance = (req, res, next) => {
    index_2.getInstance(client, req.params.identifier)
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
    handleInstance(req, res, ckanInstance => {
        index_1.packageList(ckanInstance.domain)
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
local_microservice_1.api.get('/init/:identifier', (req, res) => {
    handleInstance(req, res, ckanInstance => {
        index_2.initTables(client, ckanInstance.prefix, ckanInstance.prefix, req.route.query.filter || null)
            .then(() => {
            res.status(200).json({ message: 'Init completed' });
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            throw err;
        });
    });
});
local_microservice_1.api.get('/reset/:identifier', (req, res) => {
    handleInstance(req, res, ckanInstance => {
        index_2.resetTables(client, ckanInstance.prefix)
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
    handleInstance(req, res, ckanInstance => {
        index_2.dropTables(client, ckanInstance.prefix)
            .then(() => {
            res.status(200).json({ message: 'Drop completed' });
        })
            .catch(err => {
            res.status(500).json({ error: err.message });
            throw err;
        });
    });
});
//# sourceMappingURL=index.js.map