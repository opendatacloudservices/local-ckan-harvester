import { CkanPackageList } from './ckan/index';
import { Client } from 'pg';
import { Response, Request } from 'express';
export declare const handleInstance: (client: Client, req: Request, res: Response, next: (ckanInstance: {
    id: number;
    domain: string;
    prefix: string;
    version: number;
}) => void) => Promise<void>;
export declare const handlePackages: (list: CkanPackageList, ckanInstance: {
    domain: string;
    version: number;
    prefix: string;
}) => Promise<void>;
