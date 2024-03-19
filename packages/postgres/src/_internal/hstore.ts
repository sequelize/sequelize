// @ts-expect-error -- TODO: fork pg-hstore and add types
import PgHstore from 'pg-hstore';

const hstore = PgHstore({ sanitize: true });

type HstoreValue = boolean | number | string;

export type HstoreRecord = Record<string, HstoreValue>;

export function stringify(data: Record<string, HstoreValue>): string {
  return hstore.stringify(data);
}

export function parse(value: string): Record<string, HstoreValue> {
  return hstore.parse(value);
}
