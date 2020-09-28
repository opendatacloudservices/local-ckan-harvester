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
import * as path from 'path';
import {Client} from 'pg';

// get environmental variables
dotenv.config({path: path.join(__dirname, '../.env')});

import {api, catchAll} from 'local-microservice';
import {Response, Request} from 'express';

// TODO: Error logging and process logging
// TODO: Interface for handling all instances from database

// connect to postgres (via env vars params)
const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});
client.connect();

export const handleInstance = async (
  client: Client,
  req: Request,
  res: Response,
  next: (ckanInstance: {id: number; domain: string; prefix: string, version: number}) => void
): Promise<void> => {
  return getInstance(client, req.params.identifier)
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
  handleInstance(client, req, res, ckanInstance => {
    return packageList(ckanInstance.domain, ckanInstance.version)
      .then(async (list: CkanPackageList) => {
        for (let i = 0; i < list.result.length; i += 1) {
          await packageShow(ckanInstance.domain, ckanInstance.version, list.result[i]).then(
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
  // domain needs to include /api/.../ everything before "/action/..."
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
  handleInstance(client, req, res, ckanInstance => {
    return resetTables(client, ckanInstance.prefix)
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
  handleInstance(client, req, res, ckanInstance => {
    return dropTables(client, ckanInstance.prefix)
      .then(() => {
        res.status(200).json({message: 'Drop completed'});
      })
      .catch(err => {
        res.status(500).json({error: err.message});
        throw err;
      });
  });
});

// API to init/clear database
// TODO: postgres backup function to RAID

catchAll();
