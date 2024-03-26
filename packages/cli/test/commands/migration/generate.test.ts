import { test } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';

const __dirname = fileUrlToDirname(import.meta.url);

describe('hello', () => {
  test
    .loadConfig({
      root: __dirname,
    })
    .stdout()
    .command(['migration:generate --format=sql --name=test-migration'])
    .it('generates a test migration', ctx => {
      // expect(ctx.stdout).to.contain('hello friend from oclif!');
    });
});
