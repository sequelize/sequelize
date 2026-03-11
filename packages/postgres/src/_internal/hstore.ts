import type { HstoreRecord } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';

// PostgreSQL hstore format: "key"=>"value","key2"=>NULL
// Spec: https://www.postgresql.org/docs/current/hstore.html

function sanitize(input: string): string {
  // single quotes must be doubled, backslashes and double quotes must be escaped
  return input.replace(/'/g, "''").replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function valueToString(value: string | number | boolean | object | null): string {
  if (typeof value === 'string') {
    return sanitize(value);
  }

  return String(value);
}

export function stringifyHstore(data: HstoreRecord): string {
  return Object.keys(data)
    .map(key => {
      if (data[key] === null) {
        return `"${sanitize(key)}"=>NULL`;
      }

      return `"${sanitize(key)}"=>"${valueToString(data[key]!)}"`;
    })
    .join();
}

const HSTORE_PAIR_REGEX = /(["])(?:\\\1|\\\\|[\s\S])*?\1|NULL/g;

function unescape(value: string): string {
  return value
    .replace(/^"|"$/g, '')  // strip surrounding quotes
    .replace(/\\"/g, '"')   // unescape double quotes
    .replace(/\\\\/g, '\\') // unescape backslashes
    .replace(/''/g, "'");   // unescape single quotes
}

export function parseHstore(value: string): HstoreRecord {
  const result = Object.create(null) as HstoreRecord;
  const matches = value.match(HSTORE_PAIR_REGEX);

  if (!matches) {
    return result;
  }

  for (let i = 0; i < matches.length; i += 2) {
    const rawKey = matches[i];
    const rawValue = matches[i + 1];
    if (rawKey && rawValue) {
      result[unescape(rawKey)] = rawValue === 'NULL' ? null : unescape(rawValue);
    }
  }

  return result;
}
