import { expect } from 'chai';
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { SKELETONS_FOLDER } from './skeletons.js';

const execFileAsync = promisify(execFile);
const skeletonFiles = await readdir(SKELETONS_FOLDER);

describe('skeletons', () => {
  for (const file of skeletonFiles.filter(name => name.endsWith('.ts'))) {
    it(`${file} can be loaded with Node's built-in TypeScript support`, async () => {
      const url = pathToFileURL(join(SKELETONS_FOLDER, file)).href;

      await execFileAsync(
        process.execPath,
        ['--input-type=module', '--eval', `await import(${JSON.stringify(url)});`],
        { env: { ...process.env, NODE_OPTIONS: '' } },
      );
    });
  }

  for (const file of skeletonFiles) {
    it(`${file} declares up and down with a single context parameter`, async () => {
      const skeleton = await import(pathToFileURL(join(SKELETONS_FOLDER, file)).href);
      const { up, down } = skeleton.up ? skeleton : skeleton.default;

      expect(up).to.have.lengthOf(1);
      expect(down).to.have.lengthOf(1);
    });
  }
});
