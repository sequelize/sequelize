import { expect, test } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const __dirname = fileUrlToDirname(import.meta.url);
const packageRoot = path.join(__dirname, '..', '..', '..');

function oclifTest() {
  return test.loadConfig({
    root: packageRoot,
  });
}

describe('seed:generate', () => {
  oclifTest()
    .stdout()
    .command(['seed:generate', '--format=sql', '--name=test-seed', '--json'])
    .it('generates an SQL seed', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed/);
      expect(await fs.readdir(asJson.path)).to.have.members(['up.sql', 'down.sql']);
    });

  oclifTest()
    .stdout()
    .command(['seed:generate', '--format=typescript', '--name=test-seed', '--json'])
    .it('generates a TypeScript seed', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed\.ts/);
      await fs.access(asJson.path);
    });

  oclifTest()
    .stdout()
    .command(['seed:generate', '--format=cjs', '--name=test-seed', '--json'])
    .it('generates a CJS seed', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed\.cjs/);
      await fs.access(asJson.path);
    });

  oclifTest()
    .stdout()
    .command(['seed:generate', '--format=esm', '--name=test-seed', '--json'])
    .it('generates an ESM seed', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed\.mjs/);
      await fs.access(asJson.path);
    });

  oclifTest()
    .stdout()
    .command(['seed:generate', '--format=sql', '--no-interactive', '--json'])
    .it('supports not specifying a name', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-unnamed/);
    });
});
