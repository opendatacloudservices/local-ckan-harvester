import { Client } from 'pg';
import { CkanPackage } from '../ckan/index';
import { Response, Request } from 'express';
export declare const definition_tables: string[];
export declare const definition_master_table = "ckan_master";
export declare const definition_logs_table = "ckan_logs";
export declare type CkanInstance = {
    id: number;
    domain: string;
    prefix: string;
    version: number;
    rate_limit: number | null;
};
export declare const handleInstanceError: (res: Response, req: Request, err: Error) => void;
export declare const packageGetAction: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<string>;
export declare const processPackage: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<{
    id: string;
    status: string;
}>;
export declare const removePackage: (client: Client, prefix: string, packageId: string) => Promise<void>;
export declare const insertPackage: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<void>;
export declare const packageUpsertOrganization: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<void>;
export declare const packageInsertExtras: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<void>;
export declare const packageUpsertResources: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<void>;
export declare const packageUpsertGroups: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<void>;
export declare const packageUpsertTags: (client: Client, prefix: string, ckanPackage: CkanPackage) => Promise<void>;
export declare const masterTableExist: (client: Client) => Promise<boolean>;
export declare const initMasterTable: (client: Client) => Promise<void>;
export declare const dropMasterTable: (client: Client) => Promise<void>;
export declare const getInstance: (client: Client, identifier: string | number) => Promise<CkanInstance>;
export declare const tablesExist: (client: Client, prefix: string, tables: string[]) => Promise<boolean>;
export declare const initTables: (client: Client, prefix: string, domain: string, version: number, rate_limit?: number | undefined, filter?: string | null | undefined) => Promise<void>;
export declare const resetTables: (client: Client, prefix: string) => Promise<void>;
export declare const dropTables: (client: Client, prefix: string) => Promise<void>;
export declare const allInstances: (client: Client) => Promise<number[]>;
