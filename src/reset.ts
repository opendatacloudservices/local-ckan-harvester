import {resetTables} from './postgres/index';
import * as dotenv from 'dotenv';
import {Client} from 'pg';

// get environmental variables
dotenv.config();

// connect to postgres (via env vars params)
const client = new Client();
client.connect();

// truncate all tables with the prefix provided by the cli argument
resetTables(client, process.argv[2]).catch(err => {
  throw err;
});
