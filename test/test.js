const dotenv = require('dotenv');
const pg = require('pg');
const {packageList, packageShow} = require('../build/ckan/index');
const {
  definition_master_table,
  definition_tables,
  initMasterTable,
  initTables,
  getInstance,
  masterTableExist,
  tablesExist
} = require('../build/postgres/index');

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

client.connect();

test('check if test database is available', async () => {
  await client.query('SELECT version() AS v;').then((result) => {
    expect(result).toHaveProperty('rows');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(typeof result.rows[0].v).toBe('string');
  });

  // reset demo database
  await client.query(`SELECT 
      tablename
    FROM
      pg_tables
    WHERE
      schemaname = 'public';
  `).then((result) => {
    return Promise.all(result.rows.map((row) => {
      return client.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE;`);
    }));
  });

  await client.query(`SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';`)
    .then((result) => {
      expect(result).toHaveProperty('rows');
      expect(parseInt(result.rows[0].count)).toEqual(0);
    });
});

test('masterTableExist:false', async () => {
  await masterTableExist(client)
    .then((result) => {
      expect(result).toBe(false);
    });
});

test('initMasterTable', async () => {
  await initMasterTable(client).then(() => client.query(`SELECT 
      tablename
    FROM
      pg_tables
    WHERE
      schemaname = 'public' AND
      tablename = '${definition_master_table}';`)
  )
  .then((result) => {
    expect(result).toHaveProperty('rows');
    expect(result.rows.length).toBeGreaterThan(0);
  });
});

test('masterTableExist:true', async () => {
  await masterTableExist(client)
    .then((result) => {
      expect(result).toBe(true);
    });
});

test('tablesExist:false', async () => {
  await tablesExist(client, 'govdata', definition_tables)
    .then((result) => {
      expect(result).toBe(false);
    });
});

test('initTables (govdata, ckan.govdata.de)', async () => {
  await initTables(client, 'govdata', 'ckan.govdata.de', null)
    .then(() => client.query(`SELECT 
        tablename
      FROM
        pg_tables
      WHERE
        schemaname = 'public';`)
    )
    .then((result) => {
      let found = 0;
      definition_tables.forEach((table) => {
        result.rows.forEach((row) => {
          if (row.tablename === 'govdata_' + table) {
            found += 1;
          }
        });
      });
      expect(found).toEqual(definition_tables.length);
    });
});

test('tablesExist:true', async () => {
  await tablesExist(client, 'govdata', definition_tables)
    .then((result) => {
      expect(result).toBe(true);
    });
});

test('getInstance (govdata)', async () => {
  const ckanMatchInstance = {
    id: 1,
    prefix: 'govdata',
    domain: 'ckan.govdata.de'
  };

  await getInstance(client, 'govdata')
    .then((ckanInstance) => {
      expect(ckanInstance).toMatchObject(ckanMatchInstance);
    });

  await getInstance(client, 1)
    .then((ckanInstance) => {
      expect(ckanInstance).toMatchObject(ckanMatchInstance);
    });

  client.end();
});

// test api endpoints
// handleInstance, drop, init process, reset

// test postgres
// insertPackage
// packageGetAction
// processPackage

// removePackage
// resetTables
// dropTables
// dropMasterTable


// check if ckan exists in demo database
// drop ckan
// init ckan
// process ckan
// reset ckan
// drop ckan

// test ckan

// handleFetch


// packageList
// test('get list of packages (using ckan.govdata.de)', async () => {
//   await packageList('ckan.govdata.de').then(ckanPackageList => {
//     expect(ckanPackageList).toHaveProperty('result');
//     expect(ckanPackageList.result.length).toBeGreaterThan(0);
//     expect(typeof ckanPackageList.result[0]).toBe('string');
//   });
// });

// packageShow
// test('get an example package (using ckan.govdata.de)', async () => {
//   await packageList('ckan.govdata.de')
//     .then(ckanPackageList =>
//       packageShow('ckan.govdata.de', ckanPackageList.result[0])
//     )
//     .then(ckanPackage => {
//       expect(ckanPackage).toHaveProperty('result');
//       // TODO: Test full object structure?!
//       expect(ckanPackage.result).toHaveProperty('id');
//     });
// });

// Run tests for all ckan portals in the master db (different test file)
