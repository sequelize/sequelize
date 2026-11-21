import { expect } from 'chai';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Importing `@sequelize/core/decorators-legacy` before `@sequelize/core` used
 * to throw `ReferenceError: Cannot access 'Model' before initialization`:
 * `sequelize.js` read the `Model` binding eagerly at module load, while
 * `model.js` was still initializing (circular import).
 * Context: https://github.com/sequelize/sequelize/issues/18558
 *
 * These tests spawn a fresh process so the import order is exercised in
 * isolation (the mocha process itself already imports `@sequelize/core`).
 * They run against the built `lib/` output, like the rest of the suite.
 */

const packageRoot = path.resolve(__dirname, '..', '..');

describe('decorators-legacy first import', () => {
  it('can be imported before @sequelize/core without a TDZ error (CJS)', () => {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `require('@sequelize/core/decorators-legacy'); const { Model, Sequelize } = require('@sequelize/core'); if (Sequelize.Model !== Model) { process.exit(2); } console.log('ok');`,
      ],
      { cwd: packageRoot, encoding: 'utf8' },
    );

    expect(output.trim()).to.equal('ok');
  });

  it('can be imported before @sequelize/core without a TDZ error (ESM)', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `await import('@sequelize/core/decorators-legacy'); const { Model, Sequelize } = await import('@sequelize/core'); if (Sequelize.Model !== Model) { process.exit(2); } console.log('ok');`,
      ],
      { cwd: packageRoot, encoding: 'utf8' },
    );

    expect(output.trim()).to.equal('ok');
  });
});
