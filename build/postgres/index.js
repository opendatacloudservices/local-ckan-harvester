"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allInstances = exports.dropTables = exports.resetTables = exports.initTables = exports.tablesExist = exports.getInstance = exports.dropMasterTable = exports.initMasterTable = exports.masterTableExist = exports.packageUpsertTags = exports.packageUpsertGroups = exports.packageUpsertResources = exports.packageInsertExtras = exports.packageUpsertOrganization = exports.insertPackage = exports.removePackage = exports.processPackage = exports.packageGetAction = exports.setPackageStatus = exports.deprecatePackages = exports.resetState = exports.setQueueFailed = exports.removeFromQueue = exports.nextPackage = exports.resetQueues = exports.insertQueue = exports.handleInstanceError = exports.definition_master_table = exports.definition_tables = void 0;
const moment_1 = __importDefault(require("moment"));
const local_logger_1 = require("@opendatacloudservices/local-logger");
exports.definition_tables = [
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
exports.definition_master_table = 'ckan_master';
const handleInstanceError = (res, req, err) => {
    if (!res.headersSent) {
        if (err.message === 'Instance not found.') {
            res.status(404).json({ message: err.message });
        }
        else {
            res.status(500).json({ error: err.message });
        }
    }
    (0, local_logger_1.logError)({
        ...(0, local_logger_1.localTokens)(res),
        message: err,
        params: [JSON.stringify(req.params)],
    });
};
exports.handleInstanceError = handleInstanceError;
const insertQueue = (client, prefix, ckanPackages) => {
    return client
        .query(`INSERT INTO ${prefix}_queue (url, state) VALUES ${ckanPackages.result
        .map((p, i) => {
        return `($${i + 1}, 'new')`;
    })
        .join(',')} ON CONFLICT DO NOTHING`, ckanPackages.result)
        .then(() => { });
};
exports.insertQueue = insertQueue;
const resetQueues = (client) => {
    return (0, exports.allInstances)(client)
        .then(clientIds => {
        return Promise.all(clientIds.map(id => {
            return (0, exports.getInstance)(client, id).then(ckanInstance => {
                return client.query(`UPDATE ${ckanInstance.prefix}_queue SET state = 'new'`);
            });
        }));
    })
        .then(() => { });
};
exports.resetQueues = resetQueues;
const nextPackage = (client, ckanInstance) => {
    return client
        .query(`UPDATE ${ckanInstance.prefix}_queue
      SET state = 'downloading' 
      WHERE id = (
        SELECT id
        FROM   ${ckanInstance.prefix}_queue
        WHERE  state = 'new'
        LIMIT  1
      )
      RETURNING url;`)
        .then(result => (result.rows.length >= 0 ? result.rows[0].url : null));
};
exports.nextPackage = nextPackage;
const removeFromQueue = (client, ckanInstance, url) => {
    return client
        .query(`DELETE FROM ${ckanInstance.prefix}_queue WHERE url = $1`, [url])
        .then(() => { });
};
exports.removeFromQueue = removeFromQueue;
const setQueueFailed = (client, ckanInstance, url) => {
    return client
        .query(`UPDATE ${ckanInstance.prefix}_queue SET state = 'failed' WHERE url = $1`, [url])
        .then(() => { });
};
exports.setQueueFailed = setQueueFailed;
const resetState = (client, prefix, id) => {
    return client
        .query(`UPDATE ${prefix}_packages SET ckan_status = TO_JSON(STRING_TO_ARRAY(ckan_status, '_'))->>-1 WHERE id = $1`, [id])
        .then(() => { });
};
exports.resetState = resetState;
const deprecatePackages = (client, prefix) => {
    return client
        .query(`UPDATE ${prefix}_packages SET ckan_status = CONCAT('obsolete_', ckan_status)`)
        .then(() => { });
};
exports.deprecatePackages = deprecatePackages;
const setPackageStatus = (client, prefix, id, status) => {
    return client
        .query(`UPDATE ${prefix}_packages SET ckan_status = $1 WHERE id = $2`, [
        status,
        id,
    ])
        .then(() => { });
};
exports.setPackageStatus = setPackageStatus;
const packageGetAction = (client, prefix, ckanPackage) => {
    return client
        .query(`SELECT id, revision_id FROM ${prefix}_packages WHERE id = $1`, [
        ckanPackage.result.id,
    ])
        .then((result) => {
        if (result.rows.length === 1) {
            if (result.rows[0].revision_id === ckanPackage.result.revision_id) {
                return Promise.resolve('nothing');
            }
            else {
                return Promise.resolve('update');
            }
        }
        else {
            return Promise.resolve('insert');
        }
    });
};
exports.packageGetAction = packageGetAction;
const processPackage = (client, prefix, ckanPackage) => {
    // TODO: Apply filter here (as package_list does not support filter)
    return (0, exports.packageGetAction)(client, prefix, ckanPackage).then(async (action) => {
        if (action === 'nothing') {
            await (0, exports.resetState)(client, prefix, ckanPackage.result.id);
            return Promise.resolve({
                id: ckanPackage.result.id,
                status: 'nothing',
            });
        }
        else {
            ckanPackage.result.ckan_status = 'new';
            if (action === 'update') {
                // we are not keeping a detailed version history, as the meta data is unreliable anyway
                // if something changes, we purge the old data and add the new
                // normally a new dataset or rather id is generated by the provider anyway
                await (0, exports.removePackage)(client, prefix, ckanPackage.result.id);
                ckanPackage.result.ckan_status = 'updated';
            }
            const inserts = [
                exports.packageUpsertOrganization,
                exports.insertPackage,
                exports.packageInsertExtras,
                exports.packageUpsertResources,
                exports.packageUpsertGroups,
                exports.packageUpsertTags,
            ];
            return Promise.all(inserts.map(insert => insert(client, prefix, ckanPackage))).then(() => Promise.resolve({
                id: ckanPackage.result.id,
                status: ckanPackage.result.ckan_status || 'new',
            }));
        }
    });
};
exports.processPackage = processPackage;
const removePackage = (client, prefix, packageId) => {
    return client
        .query(`DELETE FROM ${prefix}_packages WHERE id = $1`, [packageId])
        .then(() => client.query(`DELETE FROM ${prefix}_extras WHERE package_id = $1`, [
        packageId,
    ]))
        .then(() => client.query(`DELETE FROM ${prefix}_ref_tags_packages WHERE package_id = $1`, [packageId]))
        .then(() => client.query(`DELETE FROM ${prefix}_ref_groups_packages WHERE package_id = $1`, [packageId]))
        .then(() => client.query(`DELETE FROM ${prefix}_resources WHERE id IN (
      SELECT resource_id FROM ${prefix}_ref_resources_packages WHERE package_id = $1
    )`, [packageId]))
        .then(() => client.query(`DELETE FROM ${prefix}_ref_resources_packages WHERE package_id = $1`, [packageId]))
        .then(() => 
    // remove orphan tags without packages
    client.query(`WITH temp AS (
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
          id IN (SELECT tag_id FROM temp WHERE tag_count = 0)`))
        .then(() => 
    // remove orphan resources without packages
    client.query(`WITH temp AS (
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
          id IN (SELECT resource_id FROM temp WHERE resource_count = 0)`))
        .then(() => 
    // remove orphan groups without packages
    client.query(`WITH temp AS (
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
          id IN (SELECT group_id FROM temp WHERE group_count = 0)`))
        .then(() => Promise.resolve());
};
exports.removePackage = removePackage;
const insertPackage = (client, prefix, ckanPackage) => {
    const r = ckanPackage.result;
    return client
        .query(`INSERT INTO ${prefix}_packages (
    id, name, title, revision_id, owner_org, notes, url, isopen, 
    license_id, type, creator_user_id, version, state, author_email, 
    author, metadata_modified, metadata_created, maintainer_email, 
    private, maintainer, license_title, organization_id, ckan_status) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
    $15, $16, $17, $18, $19, $20, $21, $22, $23)`, [
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
        'organization' in r ? r.organization.id : null,
        r.ckan_status || 'new',
    ])
        .then(() => {
        return Promise.resolve();
    });
};
exports.insertPackage = insertPackage;
const packageUpsertOrganization = (client, prefix, ckanPackage) => {
    if ('organization' in ckanPackage.result) {
        const o = ckanPackage.result.organization;
        return client
            .query(`INSERT INTO ${prefix}_organizations (
        id, name, title, description, type, state, image_url, 
        is_organization, created, revision_id) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) ON CONFLICT (id) DO UPDATE SET
        name = $2, title = $3, description = $4, type = $5, state = $6, image_url = $7, 
        is_organization = $8, created = $9, revision_id = $10`, [
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
        ])
            .then(() => {
            return Promise.resolve();
        });
    }
    else {
        return Promise.resolve();
    }
};
exports.packageUpsertOrganization = packageUpsertOrganization;
const packageInsertExtras = (client, prefix, ckanPackage) => {
    if (ckanPackage.result.extras && ckanPackage.result.extras.length > 0) {
        const query = `INSERT INTO ${prefix}_extras (package_id, key, value) 
      SELECT 
        (data->>'id')::text,
        (data->>'key')::text,
        (data->>'value')::text 
      FROM
        json_array_elements($1::json) AS arr(data)`;
        const data = JSON.stringify(ckanPackage.result.extras.map((d) => {
            return {
                id: ckanPackage.result.id,
                key: d.key,
                value: d.value,
            };
        }));
        return client.query(query, [data]).then(() => Promise.resolve());
    }
    else {
        return Promise.resolve();
    }
};
exports.packageInsertExtras = packageInsertExtras;
const packageUpsertResources = async (client, prefix, ckanPackage) => {
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
            const params = [];
            packageKeys.forEach((column) => {
                params.push(ckanPackage.result.resources[r][column]);
            });
            await client.query(query, params);
            await client.query(`INSERT INTO ${prefix}_ref_resources_packages (package_id, resource_id) VALUES ($1, $2)`, [ckanPackage.result.id, ckanPackage.result.resources[r].id]);
        }
    }
    return Promise.resolve();
};
exports.packageUpsertResources = packageUpsertResources;
const packageUpsertGroups = async (client, prefix, ckanPackage) => {
    if (ckanPackage.result.groups && ckanPackage.result.groups.length > 0) {
        for (let g = 0; g < ckanPackage.result.groups.length; g += 1) {
            await client.query(`INSERT INTO ${prefix}_groups (id, name, display_name, title, description, image_display_url)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET
        name = $2, display_name = $3, title = $4, description = $5, image_display_url = $6`, [
                typeof ckanPackage.result.groups[g] === 'string'
                    ? ckanPackage.result.groups[g].toString().substr(0, 36)
                    : ckanPackage.result.groups[g].id,
                typeof ckanPackage.result.groups[g] === 'string'
                    ? ckanPackage.result.groups[g]
                    : ckanPackage.result.groups[g].name,
                typeof ckanPackage.result.groups[g] === 'string'
                    ? ckanPackage.result.groups[g]
                    : ckanPackage.result.groups[g].display_name,
                typeof ckanPackage.result.groups[g] === 'string'
                    ? ckanPackage.result.groups[g]
                    : ckanPackage.result.groups[g].title,
                ckanPackage.result.groups[g].description,
                ckanPackage.result.groups[g].image_display_url,
            ]);
            await client.query(`INSERT INTO ${prefix}_ref_groups_packages (package_id, group_id) VALUES ($1, $2)`, [
                ckanPackage.result.id,
                typeof ckanPackage.result.groups[g] === 'string'
                    ? ckanPackage.result.groups[g].toString().substr(0, 36)
                    : ckanPackage.result.groups[g].id,
            ]);
        }
    }
    return Promise.resolve();
};
exports.packageUpsertGroups = packageUpsertGroups;
const packageUpsertTags = async (client, prefix, ckanPackage) => {
    if (ckanPackage.result.tags && ckanPackage.result.tags.length > 0) {
        for (let t = 0; t < ckanPackage.result.tags.length; t += 1) {
            await client.query(`INSERT INTO ${prefix}_tags (id, name, display_name, state, vocabulary_id)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET
        name = $2, display_name = $3, state = $4, vocabulary_id = $5`, [
                typeof ckanPackage.result.tags[t] === 'string'
                    ? ckanPackage.result.tags[t].toString().substr(0, 36)
                    : ckanPackage.result.tags[t].id,
                typeof ckanPackage.result.tags[t] === 'string'
                    ? ckanPackage.result.tags[t]
                    : ckanPackage.result.tags[t].name,
                typeof ckanPackage.result.tags[t] === 'string'
                    ? ckanPackage.result.tags[t]
                    : ckanPackage.result.tags[t].display_name,
                ckanPackage.result.tags[t].state,
                ckanPackage.result.tags[t].vocabulary_id,
            ]);
            await client.query(`INSERT INTO ${prefix}_ref_tags_packages (package_id, tag_id) VALUES ($1, $2)`, [
                ckanPackage.result.id,
                typeof ckanPackage.result.tags[t] === 'string'
                    ? ckanPackage.result.tags[t].toString().substr(0, 36)
                    : ckanPackage.result.tags[t].id,
            ]);
        }
    }
    return Promise.resolve();
};
exports.packageUpsertTags = packageUpsertTags;
const masterTableExist = (client) => {
    return client
        .query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${exports.definition_master_table}'`)
        .then(result => {
        if (result.rows.length > 0) {
            return Promise.resolve(true);
        }
        else {
            return Promise.resolve(false);
        }
    });
};
exports.masterTableExist = masterTableExist;
const initMasterTable = (client) => {
    return client
        .query(`CREATE TABLE ${exports.definition_master_table} (
      id SERIAL,
      prefix text NOT NULL,
      domain text NOT NULL,
      filter text,
      version integer NOT NULL,
      rate_limit integer DEFAULT NULL,
      active boolean NOT NULL,
      date_added timestamp without time zone,
      date_updated timestamp without time zone,
      CONSTRAINT ${exports.definition_master_table}_pkey PRIMARY KEY (id)
    );`)
        .then(() => Promise.resolve());
};
exports.initMasterTable = initMasterTable;
const dropMasterTable = (client) => {
    return client
        .query(`DROP TABLE ${exports.definition_master_table};`)
        .then(() => Promise.resolve());
};
exports.dropMasterTable = dropMasterTable;
const getInstance = (client, identifier) => {
    return client
        .query(`SELECT id, prefix, domain, version, rate_limit FROM ${exports.definition_master_table} WHERE ${isNaN(Number(identifier)) ? 'prefix' : 'id'} = $1`, [isNaN(Number(identifier)) ? identifier : Number(identifier)])
        .then(result => {
        if (result.rows.length === 1) {
            return Promise.resolve({
                id: result.rows[0].id,
                prefix: result.rows[0].prefix,
                domain: result.rows[0].domain,
                version: result.rows[0].version,
                rate_limit: result.rows[0].rate_limit,
            });
        }
        else {
            return Promise.reject(Error('Instance not found.'));
        }
    });
};
exports.getInstance = getInstance;
const tablesExist = (client, prefix, tables) => {
    return client
        .query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
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
        }
        else {
            return Promise.resolve(true);
        }
    });
};
exports.tablesExist = tablesExist;
const initTables = (client, prefix, domain, version, rate_limit, filter) => {
    return (0, exports.tablesExist)(client, prefix, exports.definition_tables)
        .then(exists => {
        if (exists) {
            Promise.reject(Error('Looks like the tables you are trying to create, do already exist.'));
        }
        return Promise.resolve();
    })
        .then(() => client.query(`INSERT INTO ${exports.definition_master_table} 
        (prefix, domain, version, date_added, filter, active, rate_limit)
        VALUES
        ($1, $2, $3, $4, $5, TRUE, $6);`, [
        prefix,
        domain,
        version,
        (0, moment_1.default)().format('YYYY-MM-DD hh:mm:ss'),
        filter,
        rate_limit === 0 ? null : rate_limit,
    ]))
        .then(() => client.query(`CREATE TABLE ${prefix}_groups (
        id character varying(36) NOT NULL,
        name text,
        display_name text,
        title text,
        description text,
        image_display_url text,
        CONSTRAINT ${prefix}_groups_pkey PRIMARY KEY (id)
    );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_queue (
        id SERIAL PRIMARY KEY,
        url text UNIQUE,
        state text
    );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_organizations (
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
    );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_packages (
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
    );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_extras (
        id SERIAL,
        package_id character varying(36) NOT NULL,
        key text,
        value text,
        CONSTRAINT ${prefix}_extras_pkey PRIMARY KEY (id),
        CONSTRAINT ${prefix}_extras_package_id_fkey FOREIGN KEY (package_id)
          REFERENCES ${prefix}_packages (id) MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_ref_groups_packages (
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
    );`))
        .then(() => client.query(`CREATE INDEX ${prefix}_ref_groups_packages__package_id ON ${prefix}_ref_groups_packages USING btree (package_id);`))
        .then(() => client.query(`CREATE INDEX ${prefix}_ref_groups_packages__group_id ON ${prefix}_ref_groups_packages USING btree (group_id);`))
        .then(() => client.query(`CREATE TABLE ${prefix}_resources (
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
    );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_tags (
        id character varying(36) NOT NULL,
        name text,
        display_name text,
        state text,
        vocabulary_id text,
        CONSTRAINT ${prefix}_tags_pkey PRIMARY KEY (id)
    );`))
        .then(() => client.query(`CREATE TABLE ${prefix}_ref_resources_packages (
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
    );`))
        .then(() => client.query(`CREATE INDEX ${prefix}_ref_resources_packages__package_id ON ${prefix}_ref_resources_packages USING btree (package_id);`))
        .then(() => client.query(`CREATE INDEX ${prefix}_ref_resources_packages__resource_id ON ${prefix}_ref_resources_packages USING btree (resource_id);`))
        .then(() => client.query(`CREATE TABLE ${prefix}_ref_tags_packages (
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
    );`))
        .then(() => client.query(`CREATE INDEX ${prefix}_ref_tags_packages__package_id ON ${prefix}_ref_tags_packages USING btree (package_id);`))
        .then(() => client.query(`CREATE INDEX ${prefix}_ref_tags_packages__tag_id ON ${prefix}_ref_tags_packages USING btree (tag_id);`))
        .then(() => {
        return Promise.resolve();
    });
};
exports.initTables = initTables;
const resetTables = (client, prefix) => {
    return (0, exports.tablesExist)(client, prefix, exports.definition_tables)
        .then(exists => {
        if (!exists) {
            return Promise.reject('Looks like the tables you are trying to reset, do not all exist.');
        }
        return client.query(`TRUNCATE ${exports.definition_tables
            .map(name => `${prefix}_${name}`)
            .join(',')}`);
    })
        .then(() => {
        return Promise.resolve();
    });
};
exports.resetTables = resetTables;
const dropTables = (client, prefix) => {
    return (0, exports.tablesExist)(client, prefix, exports.definition_tables)
        .then(exists => {
        if (!exists) {
            return Promise.reject('Looks like the tables you are trying to drop, do not all exist.');
        }
        return Promise.all(exports.definition_tables.map((name) => {
            return client.query(`DROP TABLE ${prefix}_${name}`);
        }));
    })
        .then(() => {
        return Promise.resolve();
    });
};
exports.dropTables = dropTables;
const allInstances = (client) => {
    return client
        .query(`SELECT id FROM ${exports.definition_master_table} WHERE active = TRUE;`, [])
        .then(result => {
        return result.rows.map(row => row.id);
    });
};
exports.allInstances = allInstances;
//# sourceMappingURL=index.js.map