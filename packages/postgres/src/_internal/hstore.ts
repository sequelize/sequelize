import type { HstoreRecord } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
// @ts-expect-error -- TODO: fork pg-hstore and add types
import PgHstore from 'pg-hstore';

const hstore = PgHstore({ sanitize: true });

export function stringifyHstore(data: HstoreRecord): string {
  return hstore.stringify(data);
}

export function parseHstore(value: string): HstoreRecord {
  return hstore.parse(value);
}
