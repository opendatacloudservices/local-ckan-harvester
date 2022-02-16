const dotenv = require('dotenv');
// get environmental variables
dotenv.config();

const pg = require('pg');
const {packageList, packageShow, handleFetch} = require('../build/ckan/index');
const {closeServer} = require('../build/index');
const {
  definition_master_table,
  definition_tables,
  initMasterTable,
  initTables,
  getInstance,
  masterTableExist,
  tablesExist,
  processPackage,
  packageGetAction,
  resetTables,
  dropTables,
  dropMasterTable,
  removePackage
} = require('../build/postgres/index');
const fetch = require('node-fetch');

const sampleData = require('./details.json');



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

test('initTables (govdata, ckan.govdata.de, 3)', async () => {
  await initTables(client, 'govdata', 'ckan.govdata.de/api/3', 3, null)
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
    domain: 'ckan.govdata.de/api/3'
  };

  await getInstance(client, 'govdata')
    .then((ckanInstance) => {
      expect(ckanInstance).toMatchObject(ckanMatchInstance);
    });

  await getInstance(client, 1)
    .then((ckanInstance) => {
      expect(ckanInstance).toMatchObject(ckanMatchInstance);
    });
});

test('getInstance (govdata)', async () => {
  const ckanMatchInstance = {
    id: 1,
    prefix: 'govdata',
    domain: 'ckan.govdata.de/api/3'
  };

  const res = {};
  res.status = () => res;
  res.json = () => res;

  await getInstance(client, 'govdata').then((ckanInstance) => {
    expect(ckanInstance).toMatchObject(ckanMatchInstance);
  });

});

test('processPackage (sample data)', async () => {
  await packageGetAction(client, 'govdata', sampleData)
    .then((result) => {
      expect(result).toEqual('insert');
      return processPackage(client, 'govdata', sampleData);
    }).then(() => {
      return packageGetAction(client, 'govdata', sampleData);
    }).then((result) => {
      expect(result).toEqual('nothing');
      sampleData.result.revision_id = "t";
      return packageGetAction(client, 'govdata', sampleData);
    }).then((result) => {
      expect(result).toEqual('update');
      return removePackage(client, 'govdata', sampleData.result.id);
    }).then(() => {
      return packageGetAction(client, 'govdata', sampleData);
    }).then((result) => {
      expect(result).toEqual('insert');
      return processPackage(client, 'govdata', sampleData);
    }).then(() => {
      return resetTables(client, 'govdata');
    }).then(() => {
      return packageGetAction(client, 'govdata', sampleData);
    }).then((result) => {
      expect(result).toEqual('insert');
    });
});

test('dropTables', async () => {
  await dropTables(client, 'govdata')
    .then(() => {
      return client.query(`SELECT 
        tablename
      FROM
        pg_tables
      WHERE
        schemaname = 'public';`)
    }).then((result) => {
      expect(result.rowCount).toEqual(2);
      return dropMasterTable(client);
    })
    .then(() => {
      return client.query(`SELECT 
        tablename
      FROM
        pg_tables
      WHERE
        schemaname = 'public';`)
    }).then((result) => {
      expect(result.rowCount).toEqual(0);
    });

  client.end();
})

test('handleFetch', async () => {
  await fetch('https://api.github.com/users/github')
    .then((response) => response.json())
    .then((json) => {
      expect(json).toHaveProperty('name');
      expect(json.name).toEqual('GitHub');
    });
})

test('packageList(using ckan.govdata.de)', async () => {
  await packageList('ckan.govdata.de/api/3', 3).then(ckanPackageList => {
    expect(ckanPackageList).toHaveProperty('result');
    expect(ckanPackageList.result.length).toBeGreaterThan(0);
    expect(typeof ckanPackageList.result[0]).toBe('string');
  });
});

test('packageShow (using ckan.govdata.de)', async () => {
  await packageList('ckan.govdata.de/api/3', 3)
    .then(ckanPackageList =>
      packageShow('ckan.govdata.de/api/3', 3, ckanPackageList.result[0])
    )
    .then(ckanPackage => {
      expect(ckanPackage).toHaveProperty('result');
      // TODO: Test full object structure?!
      expect(ckanPackage.result).toHaveProperty('id');
    });
});

// Run tests for all ckan portals in the master db (different test file)
