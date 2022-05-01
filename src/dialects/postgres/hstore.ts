const hstore = require('pg-hstore')({ sanitize: true });

type HstoreValue = boolean | number | string;

export type HstoreRecord = Record<string, HstoreValue>;

export function stringify(data: Record<string, HstoreValue>): string {
  return hstore.stringify(data);
}

export function parse(value: string): Record<string, HstoreValue> {
  return hstore.parse(value);
}
