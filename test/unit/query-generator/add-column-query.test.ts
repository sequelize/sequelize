import { DataTypes } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#addColumnQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('generates a ADD COLUMN query in supported dialects', async () => {
    const sql = queryGenerator.addColumnQuery(User.tableName, 'age', DataTypes.INTEGER);

    expectsql(sql, {
      default: `ALTER TABLE "public"."Users" ADD COLUMN "age" INTEGER;`,
      postgres: `ALTER TABLE "public"."Users" ADD COLUMN "age" INTEGER;`,
      mysql: 'ALTER TABLE `Users` ADD `age` INTEGER;',
    });
  });

  it('generates a ADD COLUMN IF NOT EXISTS query in supported dialects', async () => {
    const sql = queryGenerator.addColumnQuery(User.tableName, 'age', DataTypes.INTEGER, {
      ifNotExists: true,
    });

    expectsql(sql, {
      default: `ALTER TABLE "public"."Users" ADD COLUMN IF NOT EXISTS "age" INTEGER;`,
      postgres: `ALTER TABLE "public"."Users" ADD COLUMN IF NOT EXISTS "age" INTEGER;`,
      mysql: `ALTER TABLE "public"."Users" ADD COLUMN "age" INTEGER;`,
    });
  });
});
