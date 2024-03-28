import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const changelogPaths = [
  path.resolve(__dirname, '../CHANGELOG.md'),
  path.resolve(__dirname, '../packages/core/CHANGELOG.md'),
  path.resolve(__dirname, '../packages/utils/CHANGELOG.md'),
  path.resolve(__dirname, '../packages/validator-js/CHANGELOG.md'),
];

await Promise.all(
  changelogPaths.map(async changelogPath => {
    if (await tryAccess(changelogPath)) {
      await fs.unlink(changelogPath);
      exec(`git add ${changelogPath}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);

          return;
        }

        if (stdout) {
          console.info(`stdout: ${stdout}`);
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
      });

      console.info(`Deleted ${changelogPath}`);
    }
  }),
);

async function tryAccess(filename) {
  try {
    await fs.access(filename);

    return true;
  } catch {
    return false;
  }
}
