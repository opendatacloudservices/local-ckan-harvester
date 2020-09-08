const dotenv = require('dotenv');
const pg = require('pg');

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

test('check if test database is available', () => {
  client.query('SELECT version();')
    .then((result) => {
      expect(result.rows[0]).toBeInstanceOf(String);
    });
});

client.end();


