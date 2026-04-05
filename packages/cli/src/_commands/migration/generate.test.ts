import { runCommand } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import { expect } from 'chai';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const __dirname = fileUrlToDirname(import.meta.url);
const packageRoot = join(__dirname, '..', '..', '..');

describe('migration:generate', () => {
  it('generates an SQL migration', async () => {
    const { stdout } = await runCommand(
      ['migration:generate', '--format=sql', '--name=test-migration', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/migrations\/[\d\-t]{19}-test-migration/);
    expect(await readdir(asJson.path)).to.have.members(['up.sql', 'down.sql']);
  });

  it('generates an TypeScript migration', async () => {
    const { stdout } = await runCommand(
      ['migration:generate', '--format=typescript', '--name=test-migration', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(
      /migrations\/[\d\-t]{19}-test-migration\.ts/,
    );
    await access(asJson.path);
  });

  it('generates an CJS migration', async () => {
    const { stdout } = await runCommand(
      ['migration:generate', '--format=cjs', '--name=test-migration', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(
      /migrations\/[\d\-t]{19}-test-migration\.cjs/,
    );
    await access(asJson.path);
  });

  it('generates an ESM migration', async () => {
    const { stdout } = await runCommand(
      ['migration:generate', '--format=esm', '--name=test-migration', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(
      /migrations\/[\d\-t]{19}-test-migration\.mjs/,
    );
    await access(asJson.path);
  });

  it('supports not specifying a name', async () => {
    const { stdout } = await runCommand(
      ['migration:generate', '--format=sql', '--no-interactive', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/migrations\/[\d\-t]{19}-unnamed/);
  });
});
