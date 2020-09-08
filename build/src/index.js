"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./ckan/index");
const index_2 = require("./postgres/index");
const dotenv = require("dotenv");
const pg_1 = require("pg");
// get environmental variables
dotenv.config();
// connect to postgres (via env vars params)
const client = new pg_1.Client();
client.connect();
// get a list of all package ids from govdata
// TODO: move url to param
index_1.packageList('ckan.govdata.de')
    .then(async (list) => {
    for (let i = 0; i < list.result.length; i += 1) {
        await index_1.packageShow('ckan.govdata.de', list.result[i]).then(async (ckanPackage) => {
            return index_2.processPackage(client, 'govdata_', ckanPackage);
        });
    }
})
    .catch(err => {
    throw err;
});
//# sourceMappingURL=index.js.map