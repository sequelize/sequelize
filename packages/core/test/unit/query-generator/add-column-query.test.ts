import { DataTypes } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('QueryGenerator#addColumnQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('generates a ADD COLUMN query in supported dialects', () => {
    expectsql(() => queryGenerator.addColumnQuery(User.table, 'age', {
      type: DataTypes.INTEGER,
    }), {
      default: `ALTER TABLE [Users] ADD [age] INTEGER;`,
      mssql: `ALTER TABLE [Users] ADD [age] INTEGER NULL;`,
      postgres: `ALTER TABLE "Users" ADD COLUMN "age" INTEGER;`,
    });
  });

  it('generates a ADD COLUMN IF NOT EXISTS query in supported dialects', () => {
    expectsql(() => queryGenerator.addColumnQuery(User.table, 'age', {
      type: DataTypes.INTEGER,
    }, { ifNotExists: true }), {
      default: buildInvalidOptionReceivedError('addColumnQuery', dialectName, ['ifNotExists']),
      mariadb: 'ALTER TABLE `Users` ADD IF NOT EXISTS `age` INTEGER;',
      postgres: `ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "age" INTEGER;`,
    });
  });
});
