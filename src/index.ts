import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import {Client, QueryResult} from 'pg';

// get environmental variables
dotenv.config();

// connect to postgres (via env vars params)
const client = new Client();
client.connect();

// get a list of all package ids from govdata
fetch('https://ckan.govdata.de/api/3/action/package_list')
  .then(res => res.json())
  .then(async body => {
    for (let i = 0; i < body.result.length; i += 1) {
      // get detailed information on each package
      console.log(body.result[i], i, body.result.length);
      await fetch(
        'https://ckan.govdata.de/api/3/action/package_show?id=' + body.result[i]
      )
        .then(res => res.json())
        .then(async body => {
          // check if dataset exists
          const exists = await client
            .query('SELECT * FROM govdata_packages WHERE id = $1', [
              body.result.id,
            ])
            .then((res: QueryResult) => {
              if (res.rows.length >= 1) {
                return Promise.resolve(true);
              } else {
                return Promise.resolve(false);
              }
            });

          // check if dataset has changed

          // update dataset

          // insert dataset
          if (!exists) {
            const r = body.result;
            client
              .query(
                `INSERT INTO govdata_packages (
              id, name, title, revision_id, owner_org, notes, url, isopen, 
              license_id, type, creator_user_id, version, state, author_email, 
              author, metadata_modified, metadata_created, maintainer_email, 
              private, maintainer, license_title, organization_id) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
              $15, $16, $17, $18, $19, $20, $21, $22)`,
                [
                  r.id,
                  r.name,
                  r.title,
                  r.revision_id,
                  r.owner_org,
                  r.notes,
                  r.url,
                  r.isopen,
                  r.license_id,
                  r.type,
                  r.creator_user_id,
                  r.version,
                  r.state,
                  r.author_email,
                  r.author,
                  r.metadata_modified,
                  r.metadata_created,
                  r.maintainer_email,
                  r.private,
                  r.maintainer,
                  r.license_title,
                  r.organization.id,
                ]
              )
              .then(() => {
                return client
                  .query(
                    'SELECT id FROM govdata_organizations WHERE id = $1',
                    [r.organization.id]
                  )
                  .then((res: QueryResult<any>) => {
                    if (res.rows.length >= 1) {
                      return Promise.resolve();
                    } else {
                      const o = r.organization;
                      return client.query(
                        `INSERT INTO govdata_organizations (
                        id, name, title, description, type, state, image_url, 
                        is_organization, created, revision_id) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                        )`,
                        [
                          o.id,
                          o.name,
                          o.title,
                          o.description,
                          o.type,
                          o.state,
                          o.image_url,
                          o.is_organization,
                          o.created,
                          o.revision_id,
                        ]
                      ).then(() => {
                        return Promise.resolve();
                      });
                    }
                  });
              })
              .then(() => {
                if (r.extras && r.extras.length > 0) {
                  const query = `INSERT INTO govdata_extras (package_id, key, value) 
                    SELECT 
                      (data->>'id')::text,
                      (data->>'key')::text,
                      (data->>'value')::text 
                    FROM
                      json_array_elements($1::json) AS arr(data)`;
                  const data = JSON.stringify(
                    r.extras.map((d: {key: string; value: string}) => {
                      return {
                        id: r.id,
                        key: d.key,
                        value: d.value,
                      };
                    })
                  );
                  return client.query(query, [data])
                    .then(() => {
                      return Promise.resolve();
                    });
                } else {
                  return Promise.resolve();
                } 
              })
              .then(() => {
                if (r.resources && r.resources.length > 0) {
                  const query = `INSERT INTO govdata_resource (id, package_id, name,
                    format, cache_last_updated, issued, modified, last_modified,
                    created, license_attribution_by_text, size, conforms_to,
                    state, hash, description, mimetype_inner, url_type,
                    revision_id, mimetype, cache_url, license, language,
                    url, uri, position, access_url, resource_type)
                    SELECT 
                    (data->>'id')::text, (data->>'package_id')::text, (data->>'name')::text,
                    (data->>'format')::text, (data->>'cache_last_updated')::timestamp, (data->>'issued')::timestamp, (data->>'modified')::timestamp, (data->>'last_modified')::timestamp,
                    (data->>'created')::timestamp, (data->>'licenseAttributionByText')::text, CAST((data->>'size')::text AS DOUBLE PRECISION), (data->>'conforms_to')::text,
                    (data->>'state')::text, (data->>'hash')::text, (data->>'description')::text, (data->>'mimetype_inner')::text, (data->>'url_type')::text,
                    (data->>'revision_id')::text, (data->>'mimetype')::text, (data->>'cache_url')::text, (data->>'license')::text, (data->>'language')::text,
                    (data->>'url')::text, (data->>'uri')::text, (data->>'position')::integer, (data->>'access_url')::text, (data->>'resource_type')::text
                    FROM
                      json_array_elements($1::json) AS arr(data)`;
                  const data = JSON.stringify(
                    r.resources.map((d: {package_id: string}) => {
                      d.package_id = r.id;
                      return d;
                    })
                  );
                  return client.query(query, [data])
                    .then(() => {
                      return Promise.resolve();
                    });
                } else {
                  return Promise.resolve();
                }
              })
              .then(async () => {
                for (let j = 0; j < r.groups.length; j += 1) {
                  const res = await client.query(
                    'SELECT id FROM govdata_groups WHERE id = $1',
                    [r.groups[j].id]
                  );
                  if (res.rows.length === 0) {
                    await client.query(
                      `INSERT INTO govdata_groups (id, name, display_name, title, description, image_display_url)
                      VALUES ($1, $2, $3, $4, $5, $6)`,
                      [
                        r.groups[j].id,
                        r.groups[j].name,
                        r.groups[j].display_name,
                        r.groups[j].title,
                        r.groups[j].description,
                        r.groups[j].image_display_url,
                      ]
                    );
                  }
                  await client.query(
                    'INSERT INTO govdata_ref_groups_packages (package_id, group_id) VALUES ($1, $2)',
                    [r.id, r.groups[j].id]
                  );
                }

                for (let j = 0; j < r.tags.length; j += 1) {
                  const res = await client.query(
                    'SELECT id FROM govdata_tags WHERE id = $1',
                    [r.tags[j].id]
                  );
                  if (res.rows.length === 0) {
                    await client.query(
                      `INSERT INTO govdata_tags (id, name, display_name, state, vocabulary_id)
                      VALUES ($1, $2, $3, $4, $5)`,
                      [
                        r.tags[j].id,
                        r.tags[j].name,
                        r.tags[j].display_name,
                        r.tags[j].state,
                        r.tags[j].vocabulary_id,
                      ]
                    );
                  }
                  await client.query(
                    'INSERT INTO govdata_ref_tags_packages (package_id, tag_id) VALUES ($1, $2)',
                    [r.id, r.tags[j].id]
                  );
                }

                return Promise.resolve();
              });
          }
        })
        .catch(err => {
          throw err;
        });
    }
  })
  .then(() => {
    console.log('complete');
  })
  .catch(err => {
    throw err;
  });
