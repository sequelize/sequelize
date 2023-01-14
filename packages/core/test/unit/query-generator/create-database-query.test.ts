import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { removeUndefined } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

const notSupportedError = new Error(`Databases are not supported in ${dialectName}.`);

describe('QueryGenerator#createDatabaseQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  it('produces a CREATE DATABASE query in supported dialects', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase'), {
      default: 'CREATE DATABASE [myDatabase];',
      snowflake: 'CREATE DATABASE IF NOT EXISTS "myDatabase";',
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
      mssql: `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN CREATE DATABASE [myDatabase] ; END;`,
    });
  });

  it('supports the collate option', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase', { collate: 'en_US.UTF-8' }), {
      default: buildInvalidOptionReceivedError('createDatabaseQuery', dialectName, ['collate']),
      postgres: `CREATE DATABASE "myDatabase" LC_COLLATE = 'en_US.UTF-8';`,
      snowflake: 'CREATE DATABASE IF NOT EXISTS "myDatabase" DEFAULT COLLATE \'en_US.UTF-8\';',
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
      mssql: `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase' ) BEGIN CREATE DATABASE [myDatabase] COLLATE N'en_US.UTF-8'; END;`,
    });
  });

  it('supports the encoding option', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase', { encoding: 'UTF8' }), {
      default: buildInvalidOptionReceivedError('createDatabaseQuery', dialectName, ['encoding']),
      postgres: `CREATE DATABASE "myDatabase" ENCODING = 'UTF8';`,
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
    });
  });

  it('supports the ctype option', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase', { ctype: 'zh_TW.UTF-8' }), {
      default: buildInvalidOptionReceivedError('createDatabaseQuery', dialectName, ['ctype']),
      postgres: `CREATE DATABASE "myDatabase" LC_CTYPE = 'zh_TW.UTF-8';`,
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
    });
  });

  it('supports the template option', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase', { template: 'template0' }), {
      default: buildInvalidOptionReceivedError('createDatabaseQuery', dialectName, ['template']),
      postgres: `CREATE DATABASE "myDatabase" TEMPLATE = 'template0';`,
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
    });
  });

  it('supports the charset option', () => {
    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase', { charset: 'utf8mb4' }), {
      default: buildInvalidOptionReceivedError('createDatabaseQuery', dialectName, ['charset']),
      snowflake: `CREATE DATABASE IF NOT EXISTS "myDatabase" DEFAULT CHARACTER SET 'utf8mb4';`,
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
    });
  });

  it('supports combining all options', () => {
    const optionSupport = {
      collate: ['postgres', 'snowflake', 'mssql'],
      encoding: ['postgres'],
      ctype: ['postgres'],
      template: ['postgres'],
      charset: ['snowflake'],
    };

    const config = removeUndefined({
      collate: optionSupport.collate.includes(dialectName) ? 'en_US.UTF-8' : undefined,
      encoding: optionSupport.encoding.includes(dialectName) ? 'UTF8' : undefined,
      ctype: optionSupport.ctype.includes(dialectName) ? 'zh_TW.UTF-8' : undefined,
      template: optionSupport.template.includes(dialectName) ? 'template0' : undefined,
      charset: optionSupport.charset.includes(dialectName) ? 'utf8mb4' : undefined,
    });

    expectsql(() => queryGenerator.createDatabaseQuery('myDatabase', config), {
      'sqlite db2 ibmi mysql mariadb': notSupportedError,
      postgres: `CREATE DATABASE "myDatabase" ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'zh_TW.UTF-8' TEMPLATE = 'template0';`,
      snowflake: `CREATE DATABASE IF NOT EXISTS "myDatabase" DEFAULT CHARACTER SET 'utf8mb4' DEFAULT COLLATE 'en_US.UTF-8';`,
      mssql: `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'myDatabase') BEGIN CREATE DATABASE [myDatabase] COLLATE N'en_US.UTF-8'; END;`,
    });
  });
});
