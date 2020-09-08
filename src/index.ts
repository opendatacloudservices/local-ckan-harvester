import {
  packageList,
  packageShow,
  CkanPackageList,
  CkanPackage,
} from './ckan/index';
import {processPackage} from './postgres/index';
import * as dotenv from 'dotenv';
import {Client} from 'pg';

// get environmental variables
dotenv.config();

// connect to postgres (via env vars params)
const client = new Client();
client.connect();

// import packages from a ckan instance
const domain = process.argv[2];
const prefix = process.argv[3];

packageList(domain)
  .then(async (list: CkanPackageList) => {
    for (let i = 0; i < list.result.length; i += 1) {
      await packageShow(domain, list.result[i]).then(
        async (ckanPackage: CkanPackage) => {
          return processPackage(client, prefix, ckanPackage);
        }
      );
    }
  })
  .catch(err => {
    throw err;
  });
