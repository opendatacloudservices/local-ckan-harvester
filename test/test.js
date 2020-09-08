const dotenv = require('dotenv');
const pg = require('pg');
const {packageList, packageShow} = require('../build/src/ckan/index')

// get environmental variables
dotenv.config();

// connect to postgres (via env vars params)
const client = new pg.Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASETEST,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

test('check if test database is available', async () => {
  client.connect();
  await client.query('SELECT version() AS v;')
    .then((result) => {
      expect(result).toHaveProperty('rows');
      expect(result.rows.length).toBeGreaterThan(0);
      expect(typeof result.rows[0].v).toBe('string');
    });
  client.end();
});

// Run tests for all connected ckan portals

test('get list of packages (using ckan.govdata.de)', async () => {
  await packageList('ckan.govdata.de')
    .then((ckanPackageList) => {
      expect(ckanPackageList).toHaveProperty('result');
      expect(ckanPackageList.result.length).toBeGreaterThan(0);
      expect(typeof ckanPackageList.result[0]).toBe('string');
    });
});

test('get an example package (using ckan.govdata.de)', async () => {
  await packageList('ckan.govdata.de')
    .then((ckanPackageList) => packageShow('ckan.govdata.de', ckanPackageList.result[0]))
    .then((ckanPackage) => {
      expect(ckanPackage).toHaveProperty('result');
      // if the returned packages have another structure than expected, one of the latter tests will notice this
      expect(ckanPackage.result).toHaveProperty('id');
    });
});


