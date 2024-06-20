import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#dropSchemaQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a DROP SCHEMA query in supported dialects', () => {
    expectsql(() => queryGenerator.dropSchemaQuery('mySchema'), {
      default: 'DROP SCHEMA [mySchema]',
      db2: 'DROP SCHEMA "mySchema" RESTRICT',
      sqlite3: notSupportedError,
    });
  });

  it('produces a DROP SCHEMA IF EXISTS query in supported dialects', () => {
    expectsql(() => queryGenerator.dropSchemaQuery('mySchema', { ifExists: true }), {
      default: 'DROP SCHEMA IF EXISTS [mySchema]',
      'db2 mssql': buildInvalidOptionReceivedError('dropSchemaQuery', dialectName, ['ifExists']),
      sqlite3: notSupportedError,
    });
  });

  it('produces a DROP SCHEMA CASCADE query in supported dialects', () => {
    expectsql(() => queryGenerator.dropSchemaQuery('mySchema', { cascade: true }), {
      default: 'DROP SCHEMA [mySchema] CASCADE',
      'db2 mariadb mssql mysql': buildInvalidOptionReceivedError('dropSchemaQuery', dialectName, [
        'cascade',
      ]),
      sqlite3: notSupportedError,
    });
  });

  it('produces a DROP SCHEMA IF EXISTS CASCADE query in supported dialects', () => {
    expectsql(() => queryGenerator.dropSchemaQuery('mySchema', { cascade: true, ifExists: true }), {
      default: 'DROP SCHEMA IF EXISTS [mySchema] CASCADE',
      'db2 mssql': buildInvalidOptionReceivedError('dropSchemaQuery', dialectName, [
        'cascade',
        'ifExists',
      ]),
      'mariadb mysql': buildInvalidOptionReceivedError('dropSchemaQuery', dialectName, ['cascade']),
      sqlite3: notSupportedError,
    });
  });
});
