import { Client } from 'pg';
import { Response, Request } from 'express';
export declare const handleInstance: (client: Client, req: Request, res: Response, next: (ckanInstance: {
    id: number;
    domain: string;
    prefix: string;
}) => void) => Promise<void>;
