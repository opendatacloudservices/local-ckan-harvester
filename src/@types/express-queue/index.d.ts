// 
// declare module 'express-queue': ({activeLimit: number, queuedLimit: number}): RequestHandler<any>;

/// <reference types="node" />

declare module 'express-queue' {
  import {RequestHandler} from 'express';
  export default function (
    options:{
      activeLimit: number;
      queuedLimit: number;
    }
  ): RequestHandler<any>;
}