// Koa 扩展类型声明

declare module 'koa-static' {
  import { Middleware } from 'koa';
  function serve(root: string, options?: any): Middleware;
  export = serve;
}

declare module '@koa/cors' {
  import { Middleware } from 'koa';
  function cors(options?: any): Middleware;
  export = cors;
}

declare module '@koa/multer' {
  import { Request, Response } from 'express';
  
  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }

  interface Options {
    dest?: string;
    storage?: any;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    preservePath?: boolean;
    fileFilter?: (req: Request, file: File, cb: (error: Error | null, acceptFile: boolean) => void) => void;
  }

  interface DiskStorageOptions {
    destination?: (req: Request, file: File, cb: (error: Error | null, destination: string) => void) => void;
    filename?: (req: Request, file: File, cb: (error: Error | null, filename: string) => void) => void;
  }

  interface Multer {
    single(name: string): any;
    array(name: string, maxCount?: number): any;
    fields(fields: Array<{ name: string; maxCount?: number }>): any;
    none(): any;
    any(): any;
  }

  function multer(options?: Options): Multer;

  namespace multer {
    function diskStorage(options: DiskStorageOptions): any;
  }

  export = multer;
}

// 扩展 Koa Context 类型以支持文件上传
declare module 'koa' {
  interface Request {
    files?: { [fieldname: string]: File[] };
    file?: File;
  }
} 