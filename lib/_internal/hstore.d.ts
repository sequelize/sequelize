type HstoreValue = boolean | number | string;
export type HstoreRecord = Record<string, HstoreValue>;
export declare function stringify(data: Record<string, HstoreValue>): string;
export declare function parse(value: string): Record<string, HstoreValue>;
export {};
