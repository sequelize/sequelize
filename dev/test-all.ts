import path from 'path';
import { execSync } from 'child_process';
import { Dialect } from '../src';

const dialectsDirectory = path.resolve(__dirname, 'dialects');
const buffered = execSync(`find ${dialectsDirectory} | grep dialects | grep start.sh`).toString();
const startScripts = buffered.split(/\n/g).filter(Boolean);

// Example: { postgres: [10,12], mariadb: []}
const dialects = new Map();
startScripts.forEach((fullScriptName: string) => {
  const matches = fullScriptName.match(/.*\/(.+?)\/(.+?)\/start\.sh$/)
  if (matches){
    const [_, dialect, version] = matches;
    const versions = dialects.get(dialect);
    if(versions){
      versions.add(version)
    } else {
      dialects.set(dialect, new Set([version]))
    }
  }
})
// adding a blank version is important for sqlite to be run
dialects.set('sqlite',new Set(['']))



const tests = new Map([
  ['prepare',          {runonce: true,  count: 0}],  
  ['test-typings',     {runonce: true,  count: 0}],
  ['teaser',           {runonce: false, count: 0}],
  ['test-unit',        {runonce: false, count: 0}],
  ['test-integration', {runonce: false, count: 0}],
]);

for (const [dialect, versions] of dialects){
  for (const version of versions){
    const dialectVersion = `${dialect}${version}`;

    console.log(`\n${dialectVersion}:\n`);

    tests.forEach((properties, test) => {
      // run once
      if (properties.runonce && !properties.count){
        runTest(`yarn ${test}`)
        properties.count++;
      }

      // every dialect
      if (!properties.runonce){
        runTest(`DIALECT=${dialectVersion} yarn ${test}`);
        properties.count++
      }
    })
  }
}

function runTest(command: string){
  console.group();
  console.log(command,"\n");
  try { execSync(command, {stdio: 'inherit'}); }
  catch(e) { console.error(e); }
  console.groupEnd();
}


// NOTE: there is opportunity here for a future revision to replace the shell script with JavaSCript
