'use strict';

const execSync = require('child_process').execSync;
let isDbReady = false;

function checkDb() {
  const logs = execSync('docker logs db2').toString();
  if (logs.match(/Setup has completed/)) {
    isDbReady = true;
    clearTimeout(timeoutObj);
    clearInterval(intervalObj);
    console.log('Database is ready for use.');
  }
}

const intervalObj = setInterval(checkDb, 10000);

const timeoutObj = setTimeout(() => {
  clearInterval(intervalObj);
  if (isDbReady === false) {
    console.log('Error: Db2 docker setup has not completed in 10 minutes.');
  }
}, 10 * 60 * 1000);

checkDb();

