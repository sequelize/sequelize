import path from 'path';
import { execSync } from 'child_process';

const dialectsDirectory = path.resolve(__dirname, 'dialects');
const buffered = execSync(`find ${dialectsDirectory} | grep dialects | grep start.sh`).toString();
const startScripts = buffered.split(/\n/g);

startScripts.forEach(scriptFullFileName=>{
  if (!scriptFullFileName){
    return;
  }

  console.log(`

-------------------------------------------------------
${scriptFullFileName}  
-------------------------------------------------------
  `);

  console.group();
  try {
    execSync(`${scriptFullFileName}`, {stdio: 'inherit'});
  }
  catch(e){
    console.error(e);
  }
  console.groupEnd();
});


// NOTE: there is opportunity here for a future revision to replace the shell script with JavaSCript
