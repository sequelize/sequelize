import { DataTypes, Model } from '@sequelize/core';
import type { AbstractQueryGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { expect } from 'chai';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const queryGenerator: AbstractQueryGenerator = sequelize.queryInterface.queryGenerator;

describe('QueryGenerator#changeColumnQuery', () => {
  it('produces a query for changing a column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      // changes to the nullability of a column should not be present in these queries!
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `users` MODIFY `name` CHAR(100);',
    });
  });

  it('throws if no columns were provided', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {});
    }).to.throw('changeColumnsQuery requires at least one column to be provided');
  });

  it('supports passing a DataType instead of ColumnOptions', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: DataTypes.INTEGER,
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE INTEGER;',
      mysql: 'ALTER TABLE `users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports passing a string as the DataType', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        type: 'VARCHAR(5)',
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE VARCHAR(5);',
      mysql: 'ALTER TABLE `users` MODIFY `name` VARCHAR(5);',
    });
  });

  it('defaults the schema to the one used in Sequelize options', () => {
    const customSequelize = createSequelizeInstance({
      schema: 'custom_schema',
    });

    const sql = customSequelize.queryInterface.queryGenerator.changeColumnsQuery('users', {
      name: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `custom_schema`.`users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports passing a Model class as the tableName', () => {
    class User extends Model {}

    User.init({}, { sequelize, tableName: 'custom_users', schema: 'custom_schema' });

    const sql = queryGenerator.changeColumnsQuery(User, {
      name: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."custom_users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `custom_schema`.`custom_users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports passing a TableNameWithSchema as the tableName', () => {
    const sql = queryGenerator.changeColumnsQuery({
      schema: 'custom_schema',
      tableName: 'custom_users',
    }, {
      name: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."custom_users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `custom_schema`.`custom_users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports changing more than one column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: DataTypes.CHAR(100),
      lastName: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "lastName" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `users` MODIFY `firstName` CHAR(100), MODIFY `lastName` CHAR(100);',
    });
  });

  it('supports changing all base options', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        type: DataTypes.CHAR(100),
        allowNull: false,
        comment: 'First name of the user',
        defaultValue: 'John',
      },
      lastName: {
        type: DataTypes.CHAR(100),
        allowNull: true,
        defaultValue: 'Smith',
        comment: 'Last name of the user',
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users"
          ALTER COLUMN "firstName" TYPE CHAR(100),
          ALTER COLUMN "firstName" SET NOT NULL,
          ALTER COLUMN "firstName" SET DEFAULT 'John',
          ALTER COLUMN "lastName" TYPE CHAR(100),
          ALTER COLUMN "lastName" DROP NOT NULL,
          ALTER COLUMN "lastName" SET DEFAULT 'Smith';
        COMMENT ON COLUMN "users"."firstName" IS 'First name of the user';
        COMMENT ON COLUMN "users"."lastName" IS 'Last name of the user';`,
      mysql: `
        ALTER TABLE \`users\`
          MODIFY \`firstName\` CHAR(100) NOT NULL DEFAULT 'John' COMMENT 'First name of the user',
          MODIFY \`lastName\` CHAR(100) NULL DEFAULT 'Smith' COMMENT 'Last name of the user';`,
    });
  });

  it('supports changing the allowNull option only', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        allowNull: false,
      },
      lastName: {
        allowNull: true,
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "firstName" SET NOT NULL, ALTER COLUMN "lastName" DROP NOT NULL;',
      mysql: new Error('MySQL does not support changing the allowNull option without also specifying the type of the column'),
    });
  });

  it('supports changing the default value only', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        defaultValue: 'John',
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" SET DEFAULT 'John';`,
      mysql: new Error('MySQL does not support changing the defaultValue option without also specifying the type of the column'),
    });
  });

  it('supports changing the comment only', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        comment: 'First name of the user',
      },
    });

    expectsql(sql, {
      postgres: `COMMENT ON COLUMN "users"."firstName" IS 'First name of the user';`,
      mysql: new Error('MySQL does not support changing the comment option without also specifying the type of the column'),
    });
  });

  // This test is added because previous versions of Sequelize
  // first generated the query then used regexes to attempt to modify it, which was completely broken because default values can include anything.
  it('does not break if the default value includes special tokens', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        type: DataTypes.CHAR(100),
        defaultValue: 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT',
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "firstName" SET DEFAULT 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT';`,
      mysql: `ALTER TABLE \`users\` MODIFY \`firstName\` CHAR(100) DEFAULT 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT';`,
    });
  });
});

/*
TODO: test
  // references
  // primaryKey
  // unique
  // onUpdate
  // onDelete
  // autoIncrementIdentity
  // autoIncrement
 */
