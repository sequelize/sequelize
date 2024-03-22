/// <reference types="node" />
import type { PathLike } from 'node:fs';
export declare function listDirectories(directory: PathLike): Promise<string[]>;
