/**
 * Async generator that yields every file present in the specified folder, and is sub-folders
 *
 * @param dir
 */
export declare function listFilesRecursive(dir: string): AsyncGenerator<string, void>;
