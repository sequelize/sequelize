'use strict';

const hstore = require('pg-hstore')({sanitize : true});

function stringify(data) {
  if (data === null) return null;
  return hstore.stringify(data);
}
exports.stringify = stringify;

function parse(value) {
  if (value === null) return null;
  return hstore.parse(value);
}
exports.parse = parse;
