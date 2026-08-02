import { createRequire } from 'node:module';

// `pg-hstore` is not a runtime dependency, consumers only need it if they
// actually use the HSTORE type.
const require = createRequire(import.meta.url);

let hstore;

function getHstore() {
  hstore ??= require('pg-hstore')({ sanitize: true });

  return hstore;
}

export function stringify(data) {
  if (data === null) {
    return null;
  }

  return getHstore().stringify(data);
}

export function parse(value) {
  if (value === null) {
    return null;
  }

  return getHstore().parse(value);
}
