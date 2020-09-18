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
  getInstance,
} from './postgres/index';
import * as dotenv from 'dotenv';
import {Client} from 'pg';

// get environmental variables
// TODO: Error logging and process logging
dotenv.config();

import {api} from 'local-microservice';
import {Response, Request} from 'express';

// connect to postgres (via env vars params)
const client = new Client();
client.connect();

const handleInstance = (
  req: Request,
  res: Response,
  next: (ckanInstance: {id: number; domain: string; prefix: string}) => void
) => {
  getInstance(client, req.params.identifier)
    .then(ckanInstance => {
      next(ckanInstance);
    })
    .catch(err => {
      if (err.message === 'Instance not found.') {
        res.status(404).json({message: 'Instance not found'});
      } else {
        res.status(500).json({error: err.message});
        throw err;
      }
    });
};

api.get('/process/:identifier', (req, res) => {
  handleInstance(req, res, ckanInstance => {
    packageList(ckanInstance.domain)
      .then(async (list: CkanPackageList) => {
        for (let i = 0; i < list.result.length; i += 1) {
          await packageShow(ckanInstance.domain, list.result[i]).then(
            async (ckanPackage: CkanPackage) => {
              return processPackage(client, ckanInstance.prefix, ckanPackage);
            }
          );
        }
        res.status(200).json({message: 'Process completed'});
      })
      .catch(err => {
        res.status(500).json({error: err.message});
        throw err;
      });
  });
});

api.get('/init/:domain/:prefix', (req, res) => {
  initTables(
    client,
    req.params.prefix,
    req.params.domain,
    req.route.query.filter || null
  )
    .then(() => {
      res.status(200).json({message: 'Init completed'});
    })
    .catch(err => {
      res.status(500).json({error: err.message});
      throw err;
    });
});

api.get('/reset/:identifier', (req, res) => {
  handleInstance(req, res, ckanInstance => {
    resetTables(client, ckanInstance.prefix)
      .then(() => {
        res.status(200).json({message: 'Reset completed'});
      })
      .catch(err => {
        res.status(500).json({error: err.message});
        throw err;
      });
  });
});

api.get('/drop/:identifier', (req, res) => {
  handleInstance(req, res, ckanInstance => {
    dropTables(client, ckanInstance.prefix)
      .then(() => {
        res.status(200).json({message: 'Drop completed'});
      })
      .catch(err => {
        res.status(500).json({error: err.message});
        throw err;
      });
  });
});
