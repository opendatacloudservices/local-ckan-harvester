import fetch from 'node-fetch';
import {Response} from 'node-fetch';

export interface CkanPackageList {
  result: string[];
}

// eslint-disable-next-line
const handleFetch = (res: Response): Promise<any> => {
  if (res.status >= 200 && res.status < 300) {
    return res.json();
  } else {
    return Promise.reject(Error(res.statusText || res.status.toString()));
  }
};

export const packageList = (
  domain: string,
  version: number
): Promise<CkanPackageList> => {
  if (version === 1) {
    return fetch(`https://${domain}/rest/dataset`).then(handleFetch);
  } else {
    return fetch(`https://${domain}/action/package_list`).then(handleFetch);
  }
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
    ckan_status?: string;
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
  version: number,
  id: string
): Promise<CkanPackage> => {
  if (version === 1) {
    return fetch(`https://${domain}/rest/dataset/${id}`).then(handleFetch);
  } else {
    return fetch(`https://${domain}/action/package_show?id=${id}`).then(
      handleFetch
    );
  }
};
