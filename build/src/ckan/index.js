"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageShow = exports.packageList = void 0;
const node_fetch_1 = require("node-fetch");
exports.packageList = (domain) => {
    return node_fetch_1.default(`https://${domain}/api/3/action/package_list`).then(res => res.json());
};
exports.packageShow = (domain, id) => {
    return node_fetch_1.default(`https://${domain}/api/3/action/package_show?id=${id}`).then(res => res.json());
};
//# sourceMappingURL=index.js.map