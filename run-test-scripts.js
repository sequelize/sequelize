#!/usr/bin/env node
'use strict';

/*
The point of this is to forward Mocha options like --grep, --bail to
one more test scripts.

For example, `npm run test-unit-all --grep ignoreDuplicates --bail` will execute

  ./run-test-scripts.js test-unit-mysql,test-unit-postgres,test-unit-postgres-native,test-unit-mssql,test-unit-sqlite --grep ignoreDuplicates --bail

This script will then spawn, in sequence:

  npm run test-unit-mysql -- --grep ignoreDuplicates --bail
  npm run test-unit-postgres -- --grep ignoreDuplicates --bail
  npm run test-unit-postgres-native -- --grep ignoreDuplicates --bail
  etc.
*/

const spawn = require('child_process').spawn;
const scripts = process.argv[2].split(',');
const args = process.argv.slice(3);

let scriptIndex = 0;
function runNext() {
  const child = spawn('npm', ['run', '--', scripts[scriptIndex++]].concat(args), {stdio: 'inherit'});
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    if (code) process.exit(code);
    if (scriptIndex < scripts.length) runNext();
  });
}
runNext();
