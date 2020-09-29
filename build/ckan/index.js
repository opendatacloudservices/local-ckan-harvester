"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageShow = exports.packageList = void 0;
const node_fetch_1 = require("node-fetch");
// eslint-disable-next-line
const handleFetch = (res) => {
    if (res.status >= 200 && res.status < 300) {
        return res.json();
    }
    else {
        return Promise.reject(Error(res.statusText || res.status.toString()));
    }
};
exports.packageList = (domain, version) => {
    if (version === 1) {
        return node_fetch_1.default(`https://${domain}/rest/dataset`).then(handleFetch);
    }
    else {
        return node_fetch_1.default(`https://${domain}/action/package_list`).then(handleFetch);
    }
};
exports.packageShow = (domain, version, id) => {
    if (version === 1) {
        return node_fetch_1.default(`https://${domain}/rest/dataset/${id}`).then(handleFetch);
    }
    else {
        return node_fetch_1.default(`https://${domain}/action/package_show?id=${id}`).then(handleFetch);
    }
};
//# sourceMappingURL=index.js.map