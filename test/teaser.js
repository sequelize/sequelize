#!/usr/bin/env node
'use strict';

if (!process.env.DIALECT) {
  throw new Error('Environment variable DIALECT is undefined');
}

const DIALECT = process.env.DIALECT;
const header = '#'.repeat(DIALECT.length + 22);
const message = `${header}\n# Running tests for ${DIALECT} #\n${header}`;

console.log(message);
