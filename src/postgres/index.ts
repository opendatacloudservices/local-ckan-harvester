import {Client, QueryResult} from 'pg';
import {CkanPackage, CkanResource} from '../ckan/index';
import * as moment from 'moment';

export const definition_tables = [
  'ref_groups_packages',
  'ref_tags_packages',
  'ref_resources_packages',
  'extras',
  'groups',
  'packages',
  'organizations',
  'resources',
  'tags',
];

export const definition_master_table = 'ckan_master';
export const definition_logs_table = 'ckan_logs';

export const packageGetAction = (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<string> => {
  return client
    .query(`SELECT id, revision_id FROM ${prefix}_packages WHERE id = $1`, [
      ckanPackage.result.id,
    ])
    .then((result: QueryResult) => {
      if (result.rows.length === 1) {
        if (result.rows[0].revision_id === ckanPackage.result.revision_id) {
          return Promise.resolve('nothing');
        } else {
          return Promise.resolve('update');
        }
      } else {
        return Promise.resolve('insert');
      }
    });
};

export const processPackage = (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  // TODO: Apply filter here (as package_list does not support filter)
  return packageGetAction(client, prefix, ckanPackage).then(
    async (action: string) => {
      if (action === 'nothing') {
        return Promise.resolve();
      } else {
        if (action === 'update') {
          // we are not keeping a detailed version history, as the meta data is unreliable anyway
          // if something changes, we purge the old data and add the new
          await removePackage(client, prefix, ckanPackage.result.id);
        }

        const inserts = [
          packageUpsertOrganization,
          insertPackage,
          packageInsertExtras,
          packageUpsertResources,
          packageUpsertGroups,
          packageUpsertTags,
        ];

        return Promise.all(
          inserts.map(insert => insert(client, prefix, ckanPackage))
        ).then(() => Promise.resolve());
      }
    }
  );
};

export const removePackage = (
  client: Client,
  prefix: string,
  packageId: string
): Promise<void> => {
  return client
    .query(`DELETE FROM ${prefix}_packages WHERE id = $1`, [packageId])
    .then(() =>
      client.query(`DELETE FROM ${prefix}_extras WHERE package_id = $1`, [
        packageId,
      ])
    )
    .then(() =>
      client.query(
        `DELETE FROM ${prefix}_ref_tags_packages WHERE package_id = $1`,
        [packageId]
      )
    )
    .then(() =>
      client.query(
        `DELETE FROM ${prefix}_ref_groups_packages WHERE package_id = $1`,
        [packageId]
      )
    )
    .then(() =>
      client.query(
        `DELETE FROM ${prefix}_resources WHERE id IN (
      SELECT resource_id FROM ${prefix}_ref_resources_packages WHERE package_id = $1
    )`,
        [packageId]
      )
    )
    .then(() =>
      client.query(
        `DELETE FROM ${prefix}_ref_resources_packages WHERE package_id = $1`,
        [packageId]
      )
    )
    .then(() =>
      // remove orphan tags without packages
      client.query(
        `WITH temp AS (
            SELECT
              ${prefix}_tags.id AS tag_id,
              COUNT(*) AS tag_count
            FROM
              ${prefix}_tags
            JOIN
              ${prefix}_ref_tags_packages
              ON
                ${prefix}_ref_tags_packages.tag_id = ${prefix}_tags.id
            GROUP BY
              ${prefix}_tags.id
            ORDER BY
              tag_count ASC
        )
        DELETE FROM 
          ${prefix}_tags
        WHERE
          id IN (SELECT tag_id FROM temp WHERE tag_count = 0)`
      )
    )
    .then(() =>
      // remove orphan resources without packages
      client.query(
        `WITH temp AS (
            SELECT
              ${prefix}_resources.id AS resource_id,
              COUNT(*) AS resource_count
            FROM
              ${prefix}_resources
            JOIN
              ${prefix}_ref_resources_packages
              ON
                ${prefix}_ref_resources_packages.resource_id = ${prefix}_resources.id
            GROUP BY
              ${prefix}_resources.id
            ORDER BY
              resource_count ASC
        )
        DELETE FROM 
          ${prefix}_resources
        WHERE
          id IN (SELECT resource_id FROM temp WHERE resource_count = 0)`
      )
    )
    .then(() =>
      // remove orphan groups without packages
      client.query(
        `WITH temp AS (
            SELECT
              ${prefix}_groups.id AS group_id,
              COUNT(*) AS group_count
            FROM
              ${prefix}_groups
            JOIN
              ${prefix}_ref_groups_packages
              ON
                ${prefix}_ref_groups_packages.group_id = ${prefix}_groups.id
            GROUP BY
              ${prefix}_groups.id
            ORDER BY
              group_count ASC
        )
        DELETE FROM 
          ${prefix}_groups
        WHERE
          id IN (SELECT group_id FROM temp WHERE group_count = 0)`
      )
    )
    .then(() => Promise.resolve());
};

export const insertPackage = (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  const r = ckanPackage.result;
  return client
    .query(
      `INSERT INTO ${prefix}_packages (
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
      return Promise.resolve();
    });
};

export const packageUpsertOrganization = (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  const o = ckanPackage.result.organization;
  return client
    .query(
      `INSERT INTO ${prefix}_organizations (
      id, name, title, description, type, state, image_url, 
      is_organization, created, revision_id) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) ON CONFLICT (id) DO UPDATE SET
      name = $2, title = $3, description = $4, type = $5, state = $6, image_url = $7, 
      is_organization = $8, created = $9, revision_id = $10`,
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
    )
    .then(() => {
      return Promise.resolve();
    });
};

export const packageInsertExtras = (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  if (ckanPackage.result.extras && ckanPackage.result.extras.length > 0) {
    const query = `INSERT INTO ${prefix}_extras (package_id, key, value) 
      SELECT 
        (data->>'id')::text,
        (data->>'key')::text,
        (data->>'value')::text 
      FROM
        json_array_elements($1::json) AS arr(data)`;

    const data = JSON.stringify(
      ckanPackage.result.extras.map((d: {key: string; value: string}) => {
        return {
          id: ckanPackage.result.id,
          key: d.key,
          value: d.value,
        };
      })
    );

    return client.query(query, [data]).then(() => Promise.resolve());
  } else {
    return Promise.resolve();
  }
};

export const packageUpsertResources = async (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  if (ckanPackage.result.resources && ckanPackage.result.resources.length > 0) {
    const columns = [
      'license_attribution_by_text',
      'id',
      'name',
      'format',
      'cache_last_updated',
      'issued',
      'modified',
      'last_modified',
      'created',
      'size',
      'conforms_to',
      'state',
      'hash',
      'description',
      'mimetype_inner',
      'url_type',
      'revision_id',
      'mimetype',
      'cache_url',
      'license',
      'language',
      'url',
      'uri',
      'position',
      'access_url',
      'resource_type',
    ];

    const packageKeys = JSON.parse(JSON.stringify(columns));

    // messy json keys in CKAN
    packageKeys[0] = 'licenseAttributionByText';

    for (let r = 0; r < ckanPackage.result.resources.length; r += 1) {
      const query = `INSERT INTO ${prefix}_resources
          (${columns.join(',')})
        VALUES 
          (${columns.map((val, idx) => `$${idx + 1}`).join(',')})
        ON CONFLICT (id) DO UPDATE SET
          ${columns.map((val, idx) => `${val} = $${idx + 1}`).join(',')}`;

      const params: string[] = [];
      packageKeys.forEach((column: keyof CkanResource) => {
        params.push(ckanPackage.result.resources[r][column]);
      });

      await client.query(query, params);

      await client.query(
        `INSERT INTO ${prefix}_ref_resources_packages (package_id, resource_id) VALUES ($1, $2)`,
        [ckanPackage.result.id, ckanPackage.result.resources[r].id]
      );
    }
  }
  return Promise.resolve();
};

export const packageUpsertGroups = async (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  if (ckanPackage.result.groups && ckanPackage.result.groups.length > 0) {
    for (let g = 0; g < ckanPackage.result.groups.length; g += 1) {
      await client.query(
        `INSERT INTO ${prefix}_groups (id, name, display_name, title, description, image_display_url)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET
        name = $2, display_name = $3, title = $4, description = $5, image_display_url = $6`,
        [
          ckanPackage.result.groups[g].id,
          ckanPackage.result.groups[g].name,
          ckanPackage.result.groups[g].display_name,
          ckanPackage.result.groups[g].title,
          ckanPackage.result.groups[g].description,
          ckanPackage.result.groups[g].image_display_url,
        ]
      );

      await client.query(
        `INSERT INTO ${prefix}_ref_groups_packages (package_id, group_id) VALUES ($1, $2)`,
        [ckanPackage.result.id, ckanPackage.result.groups[g].id]
      );
    }
  }
  return Promise.resolve();
};

export const packageUpsertTags = async (
  client: Client,
  prefix: string,
  ckanPackage: CkanPackage
): Promise<void> => {
  if (ckanPackage.result.tags && ckanPackage.result.tags.length > 0) {
    for (let t = 0; t < ckanPackage.result.tags.length; t += 1) {
      await client.query(
        `INSERT INTO ${prefix}_tags (id, name, display_name, state, vocabulary_id)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET
        name = $2, display_name = $3, state = $4, vocabulary_id = $5`,
        [
          ckanPackage.result.tags[t].id,
          ckanPackage.result.tags[t].name,
          ckanPackage.result.tags[t].display_name,
          ckanPackage.result.tags[t].state,
          ckanPackage.result.tags[t].vocabulary_id,
        ]
      );

      await client.query(
        `INSERT INTO ${prefix}_ref_tags_packages (package_id, tag_id) VALUES ($1, $2)`,
        [ckanPackage.result.id, ckanPackage.result.tags[t].id]
      );
    }
  }
  return Promise.resolve();
};

export const masterTableExist = (client: Client): Promise<boolean> => {
  return client
    .query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${definition_master_table}'`
    )
    .then(result => {
      if (result.rows.length > 0) {
        return Promise.resolve(true);
      } else {
        return Promise.resolve(false);
      }
    });
};

export const initMasterTable = (client: Client): Promise<void> => {
  return client
    .query(
      `CREATE TABLE ${definition_master_table} (
      id SERIAL,
      prefix text NOT NULL,
      domain text NOT NULL,
      filter text,
      version integer NOT NULL,
      date_added timestamp without time zone,
      date_updated timestamp without time zone,
      CONSTRAINT ${definition_master_table}_pkey PRIMARY KEY (id)
    );`
    )
    .then(() =>
      client.query(`CREATE TABLE ${definition_logs_table} (
      id SERIAL,
      code text,
      label text,
      message text,
      attachment text,
      date timestamp without time zone,
      CONSTRAINT ${definition_logs_table}_pkey PRIMARY KEY (id)
    );`)
    )
    .then(() => Promise.resolve());
};

export const dropMasterTable = (client: Client): Promise<void> => {
  return client
    .query(`DROP TABLE ${definition_master_table};`)
    .then(() => client.query(`DROP TABLE ${definition_logs_table};`))
    .then(() => Promise.resolve());
};

export const getInstance = (
  client: Client,
  identifier: string | number
): Promise<{id: number; prefix: string; domain: string, version: number}> => {
  return client
    .query(
      `SELECT id, prefix, domain, version FROM ${definition_master_table} WHERE ${
        typeof identifier === 'number' ? 'id' : 'prefix'
      } = $1`,
      [identifier]
    )
    .then(result => {
      if (result.rows.length === 1) {
        return Promise.resolve({
          id: result.rows[0].id,
          prefix: result.rows[0].prefix,
          domain: result.rows[0].domain,
          version: result.rows[0].version,
        });
      } else {
        return Promise.reject(Error('Instance not found.'));
      }
    });
};

// TODO: add summary logs after runs

export const tablesExist = (
  client: Client,
  prefix: string,
  tables: string[]
): Promise<boolean> => {
  return client
    .query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )
    .then(result => {
      const found_tables = result.rows.map(row => row.table_name);
      const missing_tables = [];

      tables.forEach(table => {
        const table_name = `${prefix}_${table}`;
        if (!found_tables.includes(table_name)) {
          missing_tables.push(table_name);
        }
      });

      if (missing_tables.length > 0) {
        return Promise.resolve(false);
      } else {
        return Promise.resolve(true);
      }
    });
};

export const initTables = (
  client: Client,
  prefix: string,
  domain: string,
  filter?: string | null
): Promise<void> => {
  return tablesExist(client, prefix, definition_tables)
    .then(exists => {
      if (exists) {
        Promise.reject(
          Error(
            'Looks like the tables you are trying to create, do already exist.'
          )
        );
      }
      return Promise.resolve();
    })
    .then(() =>
      client.query(
        `INSERT INTO ${definition_master_table} 
        (prefix, domain, date_added, filter)
        VALUES
        ($1, $2, $3, $4);`,
        [prefix, domain, moment().format('YYYY-MM-DD hh:mm:ss'), filter]
      )
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_groups (
        id character varying(4) NOT NULL,
        name text,
        display_name text,
        title text,
        description text,
        image_display_url text,
        CONSTRAINT ${prefix}_groups_pkey PRIMARY KEY (id)
    );`)
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_organizations (
        id character varying(36) NOT NULL,
        name text,
        title text,
        description text,
        type text,
        state text,
        image_url text,
        is_organization boolean,
        created timestamp without time zone,
        revision_id character varying(36),
        CONSTRAINT ${prefix}_organizations_pkey PRIMARY KEY (id)
    );`)
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_packages (
        id character varying(36) NOT NULL,
        name text,
        title text,
        revision_id character varying(36),
        owner_org character varying(36),
        notes text,
        url text,
        isopen boolean,
        license_id text,
        type text,
        creator_user_id character varying(36),
        version text,
        state text,
        author_email text,
        author text,
        metadata_modified timestamp without time zone,
        metadata_created timestamp without time zone,
        maintainer_email text,
        private boolean,
        maintainer text,
        license_title text,
        organization_id character varying(36) DEFAULT NULL,
        ckan_id text,
        ckan_status text,
        CONSTRAINT ${prefix}_packages_pkey PRIMARY KEY (id),
        CONSTRAINT ${prefix}_packages_organization_id_fkey FOREIGN KEY (organization_id)
          REFERENCES ${prefix}_organizations (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE SET NULL
    );`)
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_extras (
        id SERIAL,
        package_id character varying(36) NOT NULL,
        key text,
        value text,
        CONSTRAINT ${prefix}_extras_pkey PRIMARY KEY (id),
        CONSTRAINT ${prefix}_extras_package_id_fkey FOREIGN KEY (package_id)
          REFERENCES ${prefix}_packages (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );`)
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_ref_groups_packages (
        package_id character varying(36) NOT NULL,
        group_id character varying(36) NOT NULL,
        CONSTRAINT ${prefix}_ref_groups_packages_pkey PRIMARY KEY (package_id, group_id),
        CONSTRAINT ${prefix}_ref_groups_packages_group_id_fkey FOREIGN KEY (group_id)
            REFERENCES ${prefix}_groups (id) MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT ${prefix}_ref_groups_packages_package_id_fkey FOREIGN KEY (package_id)
            REFERENCES ${prefix}_packages (id) MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );`)
    )
    .then(() =>
      client.query(
        `CREATE INDEX ${prefix}_ref_groups_packages__package_id ON ${prefix}_ref_groups_packages USING btree (package_id);`
      )
    )
    .then(() =>
      client.query(
        `CREATE INDEX ${prefix}_ref_groups_packages__group_id ON ${prefix}_ref_groups_packages USING btree (group_id);`
      )
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_resources (
        id character varying(36) NOT NULL,
        name text,
        format text,
        cache_last_updated timestamp without time zone,
        issued timestamp without time zone,
        modified timestamp without time zone,
        last_modified timestamp without time zone,
        created timestamp without time zone,
        license_attribution_by_text text,
        size double precision,
        conforms_to text,
        state text,
        hash text,
        description text,
        mimetype_inner text,
        url_type text,
        revision_id character varying(36),
        mimetype text,
        cache_url text,
        license text,
        language text,
        url text,
        uri text,
        "position" integer,
        access_url text,
        resource_type text,
        CONSTRAINT ${prefix}_resource_pkey PRIMARY KEY (id)
    );`)
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_tags (
        id character varying(36) NOT NULL,
        name text,
        display_name text,
        state text,
        vocabulary_id text,
        CONSTRAINT ${prefix}_tags_pkey PRIMARY KEY (id)
    );`)
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_ref_resources_packages (
        package_id character varying(36) NOT NULL,
        resource_id character varying(36) NOT NULL,
        CONSTRAINT ${prefix}_ref_resources_packages_pkey PRIMARY KEY (package_id, resource_id),
        CONSTRAINT ${prefix}_ref_resources_packages_package_id_fkey FOREIGN KEY (package_id)
          REFERENCES ${prefix}_packages (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        CONSTRAINT ${prefix}_ref_resources_packages_resource_id_fkey FOREIGN KEY (resource_id)
          REFERENCES ${prefix}_resources (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
    );`)
    )
    .then(() =>
      client.query(
        `CREATE INDEX ${prefix}_ref_resources_packages__package_id ON ${prefix}_ref_resources_packages USING btree (package_id);`
      )
    )
    .then(() =>
      client.query(
        `CREATE INDEX ${prefix}_ref_resources_packages__resource_id ON ${prefix}_ref_resources_packages USING btree (resource_id);`
      )
    )
    .then(() =>
      client.query(`CREATE TABLE ${prefix}_ref_tags_packages (
        package_id character varying(36) NOT NULL,
        tag_id character varying(36) NOT NULL,
        CONSTRAINT ${prefix}_ref_tags_packages_pkey PRIMARY KEY (package_id, tag_id),
        CONSTRAINT ${prefix}_ref_tags_packages_package_id_fkey FOREIGN KEY (package_id)
          REFERENCES ${prefix}_packages (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        CONSTRAINT ${prefix}_ref_tags_packages_tag_id_fkey FOREIGN KEY (tag_id)
          REFERENCES ${prefix}_tags (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
    );`)
    )
    .then(() =>
      client.query(
        `CREATE INDEX ${prefix}_ref_tags_packages__package_id ON ${prefix}_ref_tags_packages USING btree (package_id);`
      )
    )
    .then(() =>
      client.query(
        `CREATE INDEX ${prefix}_ref_tags_packages__tag_id ON ${prefix}_ref_tags_packages USING btree (tag_id);`
      )
    )
    .then(() => {
      return Promise.resolve();
    });
};

export const resetTables = (client: Client, prefix: string): Promise<void> => {
  return tablesExist(client, prefix, definition_tables)
    .then(exists => {
      if (!exists) {
        throw Error(
          'Looks like the tables you are trying to reset, do not all exist.'
        );
      }
      return client.query(
        `TRUNCATE ${definition_tables
          .map(name => `${prefix}_${name}`)
          .join(',')}`
      );
    })
    .then(() => {
      return Promise.resolve();
    });
};

export const dropTables = (client: Client, prefix: string): Promise<void> => {
  return tablesExist(client, prefix, definition_tables)
    .then(exists => {
      if (!exists) {
        throw Error(
          'Looks like the tables you are trying to drop, do not all exist.'
        );
      }
      return Promise.all(
        definition_tables.map((name: string) => {
          return client.query(`DROP TABLE ${prefix}_${name}`);
        })
      );
    })
    .then(() => {
      return Promise.resolve();
    });
};
