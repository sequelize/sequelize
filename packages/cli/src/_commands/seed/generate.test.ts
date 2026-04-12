import { runCommand } from '@oclif/test';
import { fileUrlToDirname } from '@sequelize/utils/node';
import { expect } from 'chai';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const __dirname = fileUrlToDirname(import.meta.url);
const packageRoot = join(__dirname, '..', '..', '..');

describe('seed:generate', () => {
  it('generates an SQL seed', async () => {
    const { stdout } = await runCommand(
      ['seed:generate', '--format=sql', '--name=test-seed', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed/);
    expect(await readdir(asJson.path)).to.have.members(['up.sql', 'down.sql']);
  });

  it('generates a TypeScript seed', async () => {
    const { stdout } = await runCommand(
      ['seed:generate', '--format=typescript', '--name=test-seed', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed\.ts/);
    await access(asJson.path);
  });

  it('generates a CJS seed', async () => {
    const { stdout } = await runCommand(
      ['seed:generate', '--format=cjs', '--name=test-seed', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed\.cjs/);
    await access(asJson.path);
  });

  it('generates a ESM seed', async () => {
    const { stdout } = await runCommand(
      ['seed:generate', '--format=esm', '--name=test-seed', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-test-seed\.mjs/);
    await access(asJson.path);
  });

  it('supports not specifying a name', async () => {
    const { stdout } = await runCommand(
      ['seed:generate', '--format=sql', '--no-interactive', '--json'],
      { root: packageRoot },
    );
    const asJson = JSON.parse(stdout);

    expect(Object.keys(asJson)).to.deep.eq(['path']);
    expect(pathToFileURL(asJson.path).pathname).to.match(/seeds\/[\d\-t]{19}-unnamed/);
  });
});
