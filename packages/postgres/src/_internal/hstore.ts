import type { HstoreRecord } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';

// PostgreSQL hstore format: "key"=>"value","key2"=>NULL
// Spec: https://www.postgresql.org/docs/current/hstore.html

function sanitize(input: string): string {
  // hstore only escapes backslashes and double quotes (single quotes are not special in hstore format)
  // SQL-level quoting is handled separately by the dialect's escapeString / bind parameters
  return input.replaceAll(/[\\"]/g, '\\$&');
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

      return `"${sanitize(key)}"=>"${valueToString(data[key])}"`;
    })
    .join(',');
}

const HSTORE_PAIR_REGEX = /NULL|"(?:[^"\\]|\\.)*"/g;

function unescapeHstoreValue(value: string): string {
  return value
    .slice(1, -1) // strip surrounding quotes
    .replaceAll(/\\(["\\])/g, '$1'); // unescape \" and \\ in one pass
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
      result[unescapeHstoreValue(rawKey)] =
        rawValue === 'NULL' ? null : unescapeHstoreValue(rawValue);
    }
  }

  return result;
}
