"use strict";
// DANGER ZONE - THIS REMOVES ALL METADATA FROM THE DATABASE !!!
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const pg_1 = require("pg");
const process_1 = require("process");
// get environmental variables
dotenv.config();
// connect to postgres (via env vars params)
const client = new pg_1.Client();
client.connect();
// clean all govdata related tables
const prefix = 'govdata_';
const tables = [
    'extras',
    'groups',
    'organizations',
    'packages',
    'ref_groups_packages',
    'ref_tags_packages',
    'ref_resources_packages',
    'resources',
    'tags'
];
Promise.all(tables.map((name) => {
    return client.query(`TRUNCATE ${prefix}${name}`);
}))
    .then(() => {
    process_1.stdout.write('All tables truncated.');
    process.exit();
})
    .catch((err) => {
    throw err;
});
//# sourceMappingURL=reset.js.map