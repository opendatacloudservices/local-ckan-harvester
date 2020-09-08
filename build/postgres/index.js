"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTables = exports.packageInsertTags = exports.packageInsertGroups = exports.packageInsertResources = exports.packageInsertExtras = exports.packageUpsertOrganization = exports.insertPackage = exports.removePackage = exports.processPackage = exports.packageGetAction = void 0;
exports.packageGetAction = (client, prefix, ckanPackage) => {
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
exports.processPackage = (client, prefix, ckanPackage) => {
    return exports.packageGetAction(client, prefix, ckanPackage).then(async (action) => {
        if (action === 'nothing') {
            return Promise.resolve();
        }
        else {
            if (action === 'update') {
                // we are not keeping a detailed version history, as the meta data is unreliable anyway
                // if something changes, we purge the old data and add the new
                await exports.removePackage(client, prefix, ckanPackage);
            }
            return exports.insertPackage(client, prefix, ckanPackage).then(() => Promise.resolve());
        }
    });
};
exports.removePackage = (client, prefix, ckanPackage) => {
    // we don't touch organizations, tags and groups, this could lead to orphan items in those meta tables
    // TODO: check if organizations, tags and groups are actually used otherwise remove
    return client
        .query(`DELETE FROM ${prefix}_packages WHERE id = $1`, [
        ckanPackage.result.id,
    ])
        .then(() => client.query(`DELETE FROM ${prefix}_extras WHERE package_id = $1`, [
        ckanPackage.result.id,
    ]))
        .then(() => client.query(`DELETE FROM ${prefix}_ref_tags_packages WHERE package_id = $1`, [ckanPackage.result.id]))
        .then(() => client.query(`DELETE FROM ${prefix}_ref_groups_packages WHERE package_id = $1`, [ckanPackage.result.id]))
        .then(() => client.query(`DELETE FROM ${prefix}_resources WHERE resource_id IN (
      SELECT resource_id FROM ${prefix}_ref_resources_packages WHERE package_id = $1
    )`, [ckanPackage.result.id]))
        .then(() => client.query(`DELETE FROM ${prefix}_ref_resources_packages WHERE package_id = $1`, [ckanPackage.result.id]))
        .then(() => Promise.resolve());
};
exports.insertPackage = (client, prefix, ckanPackage) => {
    const r = ckanPackage.result;
    return client.query(`INSERT INTO ${prefix}_packages (
    id, name, title, revision_id, owner_org, notes, url, isopen, 
    license_id, type, creator_user_id, version, state, author_email, 
    author, metadata_modified, metadata_created, maintainer_email, 
    private, maintainer, license_title, organization_id) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
    $15, $16, $17, $18, $19, $20, $21, $22)`, [
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
    ]);
};
exports.packageUpsertOrganization = (client, prefix, ckanPackage) => {
    const o = ckanPackage.result.organization;
    return client.query(`INSERT INTO ${prefix}_organizations (
      id, name, title, description, type, state, image_url, 
      is_organization, created, revision_id) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) ON CONFLICT (id) DO UPATE SET
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
    ]);
};
exports.packageInsertExtras = (client, prefix, ckanPackage) => {
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
exports.packageInsertResources = async (client, prefix, ckanPackage) => {
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
        const packageKeys = columns;
        // messy json keys in CKAN
        packageKeys[0] = 'licenseAttributionByText';
        for (let r = 0; r < ckanPackage.result.resources.length; r += 1) {
            const query = `INSERT INTO ${prefix}_resources
          (${columns.join(',')})
        VALUES 
          (${new Array(columns.length)
                .map((val, idx) => `$${idx + 1}`)
                .join(',')})
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
exports.packageInsertGroups = async (client, prefix, ckanPackage) => {
    if (ckanPackage.result.groups && ckanPackage.result.groups.length > 0) {
        for (let g = 0; g < ckanPackage.result.groups.length; g += 1) {
            await client.query(`INSERT INTO ${prefix}_groups (id, name, display_name, title, description, image_display_url)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET
        name = $2, display_name = $3, title = $4, description = $5, image_display_url = $6`, [
                ckanPackage.result.groups[g].id,
                ckanPackage.result.groups[g].name,
                ckanPackage.result.groups[g].display_name,
                ckanPackage.result.groups[g].title,
                ckanPackage.result.groups[g].description,
                ckanPackage.result.groups[g].image_display_url,
            ]);
            await client.query(`INSERT INTO ${prefix}_ref_groups_packages (package_id, group_id) VALUES ($1, $2)`, [ckanPackage.result.id, ckanPackage.result.groups[g].id]);
        }
    }
    return Promise.resolve();
};
exports.packageInsertTags = async (client, prefix, ckanPackage) => {
    if (ckanPackage.result.tags && ckanPackage.result.tags.length > 0) {
        for (let t = 0; t < ckanPackage.result.tags.length; t += 1) {
            await client.query(`INSERT INTO ${prefix}_tags (id, name, display_name, state, vocabulary_id)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET
        name = $2, display_name = $3, state = $4, vocabulary_id = $5`, [
                ckanPackage.result.tags[t].id,
                ckanPackage.result.tags[t].name,
                ckanPackage.result.tags[t].display_name,
                ckanPackage.result.tags[t].state,
                ckanPackage.result.tags[t].vocabulary_id,
            ]);
            await client.query(`INSERT INTO ${prefix}_ref_tags_packages (package_id, tag_id) VALUES ($1, $2)`, [ckanPackage.result.id, ckanPackage.result.tags[t].id]);
        }
    }
    return Promise.resolve();
};
exports.resetTables = (client, prefix) => {
    const tables = [
        'extras',
        'groups',
        'organizations',
        'packages',
        'ref_groups_packages',
        'ref_tags_packages',
        'ref_resources_packages',
        'resources',
        'tags',
    ];
    return Promise.all(tables.map((name) => {
        return client.query(`TRUNCATE ${prefix}_${name}`);
    })).then(() => {
        return Promise.resolve();
    });
};
//# sourceMappingURL=index.js.map