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

// get a list of all package ids from govdata
// TODO: move url to param

packageList('ckan.govdata.de')
  .then(async (list: CkanPackageList) => {
    for (let i = 0; i < list.result.length; i += 1) {
      await packageShow('ckan.govdata.de', list.result[i]).then(
        async (ckanPackage: CkanPackage) => {
          return processPackage(client, 'govdata_', ckanPackage);
        }
      );
    }
  })
  .catch(err => {
    throw err;
  });
