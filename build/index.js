"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./ckan/index");
const index_2 = require("./postgres/index");
const dotenv = require("dotenv");
const pg_1 = require("pg");
// get environmental variables
dotenv.config();
const local_microservice_1 = require("local-microservice");
// connect to postgres (via env vars params)
const client = new pg_1.Client();
client.connect();
local_microservice_1.api.get('/process/:prefix/:domain', (req, res) => {
    // TODO: check if prefix and domain exist > store prefix and domain in a database and only send domain?
    index_1.packageList(req.params.domain)
        .then(async (list) => {
        for (let i = 0; i < list.result.length; i += 1) {
            await index_1.packageShow(req.params.domain, list.result[i]).then(async (ckanPackage) => {
                return index_2.processPackage(client, req.params.prefix, ckanPackage);
            });
        }
        res.status(200).json({ message: 'Process completed' });
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
    });
});
local_microservice_1.api.get('/init/:prefix', (req, res) => {
    index_2.initTables(client, req.params.prefix)
        .then(() => {
        res.status(200).json({ message: 'Init completed' });
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
    });
});
local_microservice_1.api.get('/reset/:prefix', (req, res) => {
    index_2.resetTables(client, process.argv[2])
        .then(() => {
        res.status(200).json({ message: 'Reset completed' });
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
    });
});
local_microservice_1.api.get('/drop/:prefix', (req, res) => {
    index_2.dropTables(client, process.argv[2])
        .then(() => {
        res.status(200).json({ message: 'Drop completed' });
    })
        .catch(err => {
        res.status(500).json({ error: err.message });
        throw err;
    });
});
//# sourceMappingURL=index.js.map