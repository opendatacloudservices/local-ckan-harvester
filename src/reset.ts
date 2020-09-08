// DANGER ZONE - THIS REMOVES ALL METADATA FROM THE DATABASE !!!

import * as dotenv from 'dotenv';
import {Client} from 'pg';
import {stdout} from 'process';

// get environmental variables
dotenv.config();

// connect to postgres (via env vars params)
const client = new Client();
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
  'tags',
];

Promise.all(
  tables.map(name => {
    return client.query(`TRUNCATE ${prefix}${name}`);
  })
)
  .then(() => {
    stdout.write('All tables truncated.');
    throw Error('Tables reset.');
  })
  .catch(err => {
    throw err;
  });
