import {
  packageList,
  packageShow,
  CkanPackageList,
  CkanPackage,
} from './ckan/index';
import {
  processPackage,
  initTables,
  resetTables,
  dropTables,
} from './postgres/index';
import * as dotenv from 'dotenv';
import {Client} from 'pg';

// get environmental variables
dotenv.config();

import {api, startTransaction, startSpan} from 'local-microservice';

// connect to postgres (via env vars params)
const client = new Client();
client.connect();

api.get('/process/:prefix/:domain', (req, res) => {
  const transaction = startTransaction('process', {

  });

  // TODO: check if prefix and domain exist > store prefix and domain in a database and only send domain?
  packageList(req.params.domain)
    .then(async (list: CkanPackageList) => {
      for (let i = 0; i < list.result.length; i += 1) {
        const span = startSpan('receiveAndProcessPackage');
        await packageShow(req.params.domain, list.result[i]).then(
          async (ckanPackage: CkanPackage) => {
            return processPackage(client, req.params.prefix, ckanPackage);
          }
        );
        if (span) {
          // TODO, bundle in local-microservice
          span.end();
        }
      }
      res.status(200).json({message: 'Process completed'});
      // TODO, bundle in local-microservice
      if (transaction) {
        transaction.result = 'success';
        transaction.end();
      }
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      // TODO, bundle in local-microservice
      if (transaction) {
        transaction.result = 'error';
        transaction.end();
      }
      throw err;
    });
});

api.get('/init/:prefix', (req, res) => {
  initTables(client, req.params.prefix)
    .then(() => {
      res.status(200).json({message: 'Init completed'});
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      throw err;
    });
});

api.get('/reset/:prefix', (req, res) => {
  resetTables(client, process.argv[2])
    .then(() => {
      res.status(200).json({message: 'Reset completed'});
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      throw err;
    });
});

api.get('/drop/:prefix', (req, res) => {
  dropTables(client, process.argv[2])
    .then(() => {
      res.status(200).json({message: 'Drop completed'});
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      throw err;
    });
});
