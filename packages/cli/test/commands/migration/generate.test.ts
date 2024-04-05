import { expect, test } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import fs from 'node:fs/promises';

const __dirname = fileUrlToDirname(import.meta.url);

function oclifTest() {
  return test.loadConfig({
    root: __dirname,
  });
}

describe('migration:generate', () => {
  oclifTest()
    .stdout()
    .command(['migration:generate', '--format=sql', '--name=test-migration', '--json'])
    .it('generates an SQL migration', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(asJson.path).to.match(/migrations\/[\d\-t]{19}-test-migration/);
      expect(await fs.readdir(asJson.path)).to.have.members(['up.sql', 'down.sql']);
    });

  oclifTest()
    .stdout()
    .command(['migration:generate', '--format=typescript', '--name=test-migration', '--json'])
    .it('generates a TypeScript migration', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(asJson.path).to.match(/migrations\/[\d\-t]{19}-test-migration\.ts/);
      await fs.access(asJson.path);
    });

  oclifTest()
    .stdout()
    .command(['migration:generate', '--format=cjs', '--name=test-migration', '--json'])
    .it('generates a CJS migration', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(asJson.path).to.match(/migrations\/[\d\-t]{19}-test-migration\.cjs/);
      await fs.access(asJson.path);
    });

  oclifTest()
    .stdout()
    .command(['migration:generate', '--format=esm', '--name=test-migration', '--json'])
    .it('generates an ESM migration', async ctx => {
      const asJson = JSON.parse(ctx.stdout);

      expect(Object.keys(asJson)).to.deep.eq(['path']);
      expect(asJson.path).to.match(/migrations\/[\d\-t]{19}-test-migration\.mjs/);
      await fs.access(asJson.path);
    });
});
