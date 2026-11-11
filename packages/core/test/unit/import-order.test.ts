import { expect } from 'chai';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Importing `@sequelize/core/decorators-legacy` before `@sequelize/core` used to crash
 * with `ReferenceError: Cannot access 'Model' before initialization`, because
 * `Sequelize.Model` was assigned eagerly while `model.js` was still initializing.
 * Context: https://github.com/sequelize/sequelize/issues/18558
 *
 * The import order only matters in a fresh process, so each case below runs in a
 * child process that imports `decorators-legacy` first.
 */
describe('import order', () => {
  // The @sequelize/core package root (two levels up from test/unit).
  const packageRoot = path.resolve(__dirname, '..', '..');

  function runNode(code: string, extraArgs: string[] = []): string {
    return execFileSync(process.execPath, [...extraArgs, '-e', code], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 60_000,
    });
  }

  it('allows importing @sequelize/core/decorators-legacy before @sequelize/core (CommonJS)', () => {
    const output = runNode(
      [
        `require('@sequelize/core/decorators-legacy');`,
        `const { Sequelize } = require('@sequelize/core');`,
        `const { Model } = require('@sequelize/core');`,
        `if (Sequelize.Model !== Model) {`,
        `  throw new Error('Sequelize.Model is not the Model class');`,
        `}`,
        `console.log('ok');`,
      ].join('\n'),
    );

    expect(output).to.include('ok');
  });

  it('allows importing @sequelize/core/decorators-legacy before @sequelize/core (ESM)', () => {
    const output = runNode(
      [
        `import '@sequelize/core/decorators-legacy';`,
        `import { Sequelize, Model } from '@sequelize/core';`,
        `if (Sequelize.Model !== Model) {`,
        `  throw new Error('Sequelize.Model is not the Model class');`,
        `}`,
        `console.log('ok');`,
      ].join('\n'),
      ['--input-type=module'],
    );

    expect(output).to.include('ok');
  });
});
