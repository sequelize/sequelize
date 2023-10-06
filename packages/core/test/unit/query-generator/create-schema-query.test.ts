import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Schemas are not supported in ${dialectName}.`);

describe('QueryGenerator#createSchemaQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a CREATE SCHEMA query in supported dialects', () => {
    expectsql(() => queryGenerator.createSchemaQuery('myDatabase'), {
      default: 'CREATE SCHEMA IF NOT EXISTS [myDatabase];',
      db2: 'CREATE SCHEMA "myDatabase";',
      ibmi: 'CREATE SCHEMA "myDatabase"',
      mssql: `IF NOT EXISTS (SELECT schema_name FROM information_schema.schemata WHERE schema_name = N'myDatabase') BEGIN EXEC sp_executesql N'CREATE SCHEMA [myDatabase] ;' END;`,
      sqlite: notSupportedError,
    });
  });

  it('supports the collate option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('myDatabase', { collate: 'en_US.UTF-8' }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['collate']),
      'mysql mariadb': `CREATE SCHEMA IF NOT EXISTS \`myDatabase\` DEFAULT COLLATE 'en_US.UTF-8';`,
      sqlite: notSupportedError,
    });
  });

  it('supports the charset option', () => {
    expectsql(() => queryGenerator.createSchemaQuery('myDatabase', { charset: 'utf8mb4' }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['charset']),
      'mysql mariadb': `CREATE SCHEMA IF NOT EXISTS \`myDatabase\` DEFAULT CHARACTER SET 'utf8mb4';`,
      sqlite: notSupportedError,
    });
  });

  it('supports specifying all possible combinations', () => {
    expectsql(() => queryGenerator.createSchemaQuery('myDatabase', { charset: 'utf8mb4', collate: 'en_US.UTF-8' }), {
      default: buildInvalidOptionReceivedError('createSchemaQuery', dialectName, ['charset', 'collate']),
      'mysql mariadb': `CREATE SCHEMA IF NOT EXISTS \`myDatabase\` DEFAULT CHARACTER SET 'utf8mb4' DEFAULT COLLATE 'en_US.UTF-8';`,
      sqlite: notSupportedError,
    });
  });
});
