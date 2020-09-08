"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./postgres/index");
const dotenv = require("dotenv");
const pg_1 = require("pg");
// get environmental variables
dotenv.config();
// connect to postgres (via env vars params)
const client = new pg_1.Client();
client.connect();
// truncate all tables with the prefix provided by the cli argument
index_1.initTables(client, process.argv[2]).catch(err => {
    throw err;
});
//# sourceMappingURL=init.js.map