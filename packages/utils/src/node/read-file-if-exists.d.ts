/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import type { Abortable } from 'node:events';
import type { ObjectEncodingOptions, OpenMode, PathLike } from 'node:fs';
export interface ReadFileOptions extends Abortable, ObjectEncodingOptions {
    flag?: OpenMode | undefined;
}
export declare function readFileIfExists(filePath: PathLike, options?: ReadFileOptions): Promise<string | Buffer | null>;
