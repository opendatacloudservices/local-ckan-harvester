"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageShow = exports.packageList = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
// eslint-disable-next-line
const handleFetch = (res) => {
    if (res.status >= 200 && res.status < 300) {
        return res.json().then(json => {
            // api v1 fix
            if (!('result' in json)) {
                json = { result: json };
            }
            return Promise.resolve(json);
        });
    }
    else {
        return Promise.reject(Error(res.statusText || res.status.toString()));
    }
};
const packageList = (domain, version) => {
    if (version === 1) {
        return (0, node_fetch_1.default)(`https://${domain}/rest/dataset`).then(handleFetch);
    }
    else {
        return (0, node_fetch_1.default)(`https://${domain}/action/package_list`).then(handleFetch);
    }
};
exports.packageList = packageList;
const packageShow = (domain, version, id) => {
    if (version === 1) {
        return (0, node_fetch_1.default)(`https://${domain}/rest/dataset/${id}`).then(handleFetch);
    }
    else {
        return (0, node_fetch_1.default)(`https://${domain}/action/package_show?id=${id}`).then(handleFetch);
    }
};
exports.packageShow = packageShow;
//# sourceMappingURL=index.js.map