import { sql } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#createSchemaQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a CREATE SCHEMA query in supported dialects', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema'), {
      default: 'CREATE SCHEMA [mySchema]',
      sqlite3: notSupportedError,
    });
  });

  it('supports the authorization option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema', { authorization: 'myUser' }), {
      default: 'CREATE SCHEMA [mySchema] AUTHORIZATION [myUser]',
      sqlite3: notSupportedError,
      'mariadb mysql snowflake': buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
        'authorization',
      ]),
    });
  });

  it('supports the authorization option with a literal', () => {
    expectsql(
      () => queryGenerator.createSchemaQuery('mySchema', { authorization: sql`CURRENT USER` }),
      {
        default: 'CREATE SCHEMA [mySchema] AUTHORIZATION CURRENT USER',
        sqlite3: notSupportedError,
        'mariadb mysql snowflake': buildInvalidOptionReceivedError(
          'createSchemaQuery',
          dialectName,
          ['authorization'],
        ),
      },
    );
  });

  it('supports the charset option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema', { charset: 'utf8mb4' }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['charset']),
      'mysql mariadb': `CREATE SCHEMA \`mySchema\` DEFAULT CHARACTER SET 'utf8mb4'`,
      sqlite3: notSupportedError,
    });
  });

  it('supports the collate option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema', { collate: 'en_US.UTF-8' }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['collate']),
      'mysql mariadb': `CREATE SCHEMA \`mySchema\` DEFAULT COLLATE 'en_US.UTF-8'`,
      sqlite3: notSupportedError,
    });
  });

  it('supports the comment option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema', { comment: 'myComment' }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['comment']),
      snowflake: `CREATE SCHEMA "mySchema" COMMENT 'myComment'`,
      sqlite3: notSupportedError,
    });
  });

  it('supports the ifNotExists option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema', { ifNotExists: true }), {
      default: 'CREATE SCHEMA IF NOT EXISTS [mySchema]',
      'db2 ibmi mssql': buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
        'ifNotExists',
      ]),
      sqlite3: notSupportedError,
    });
  });

  it('supports the replace option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('mySchema', { replace: true }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['replace']),
      'mariadb snowflake': `CREATE OR REPLACE SCHEMA [mySchema]`,
      sqlite3: notSupportedError,
    });
  });

  it('supports specifying all possible combinations', () => {
    expectsql(
      () =>
        queryGenerator.createSchemaQuery('mySchema', {
          authorization: 'myUser',
          charset: 'utf8mb4',
          collate: 'en_US.UTF-8',
          comment: 'myComment',
          ifNotExists: true,
          replace: true,
        }),
      {
        default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
          'charset',
          'collate',
          'comment',
          'ifNotExists',
          'replace',
        ]),
        mariadb: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
          'authorization',
          'comment',
        ]),
        mysql: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
          'authorization',
          'comment',
          'replace',
        ]),
        postgres: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
          'charset',
          'collate',
          'comment',
          'replace',
        ]),
        snowflake: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, [
          'authorization',
          'charset',
          'collate',
        ]),
        sqlite3: notSupportedError,
      },
    );
  });
});
