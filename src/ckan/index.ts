import fetch from 'node-fetch';

// TODO: Handle broken internet connection?! < FetchError: invalid json response body at.... unexpected token ... in JSON

export interface CkanPackageList {
  result: string[];
}

// TODO: replace prefix & table through master call > (number || string) 

export const packageList = (domain: string): Promise<CkanPackageList> => {
  return fetch(`https://${domain}/api/3/action/package_list`).then(res =>
    res.json()
  );
};

export interface CkanPackage {
  result: {
    id: string;
    name: string;
    title: string;
    revision_id: string;
    owner_org: string;
    notes: string;
    url: string;
    isopen: string;
    license_id: string;
    type: string;
    creator_user_id: string;
    version: string;
    state: string;
    author_email: string;
    author: string;
    metadata_modified: string;
    metadata_created: string;
    maintainer_email: string;
    private: string;
    maintainer: string;
    license_title: string;
    organization: {
      id: string;
      name: string;
      title: string;
      description: string;
      type: string;
      state: string;
      image_url: string;
      is_organization: string;
      created: string;
      revision_id: string;
    };
    extras: {
      key: string;
      value: string;
    }[];
    resources: CkanResource[];
    groups: {
      id: string;
      name: string;
      display_name: string;
      title: string;
      description: string;
      image_display_url: string;
    }[];
    tags: {
      id: string;
      name: string;
      display_name: string;
      state: string;
      vocabulary_id: string;
    }[];
  };
}

export type CkanResource = {
  [key: string]: string;
  id: string;
  name: string;
  format: string;
  cache_last_updated: string;
  issued: string;
  modified: string;
  last_modified: string;
  created: string;
  licenseAttributionByText: string;
  size: string;
  conforms_to: string;
  state: string;
  hash: string;
  description: string;
  mimetype_inner: string;
  url_type: string;
  revision_id: string;
  mimetype: string;
  cache_url: string;
  license: string;
  language: string;
  url: string;
  uri: string;
  position: string;
  access_url: string;
  resource_type: string;
};

export const packageShow = (
  domain: string,
  id: string
): Promise<CkanPackage> => {
  return fetch(
    `https://${domain}/api/3/action/package_show?id=${id}`
  ).then(res => res.json());
};
