'use strict';

const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const queryGenerator = current.dialect.queryGenerator;

const customSequelize = Support.createSequelizeInstance({
  schema: 'custom',
});
const customSql = customSequelize.dialect.queryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('addColumn', () => {
    const User = current.define('User', {}, { timestamps: false });

    if (['mysql', 'mariadb'].includes(current.dialect.name)) {
      it('properly generate alter queries', () => {
        return expectsql(
          queryGenerator.addColumnQuery(
            User.table,
            'level_id',
            current.normalizeAttribute({
              type: DataTypes.FLOAT,
              allowNull: false,
            }),
          ),
          {
            mariadb: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;',
            mysql: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;',
          },
        );
      });

      it('properly generate alter queries for foreign keys', () => {
        return expectsql(
          queryGenerator.addColumnQuery(
            User.table,
            'level_id',
            current.normalizeAttribute({
              type: DataTypes.INTEGER,
              references: {
                table: 'level',
                key: 'id',
              },
              onUpdate: 'cascade',
              onDelete: 'cascade',
            }),
          ),
          {
            mariadb:
              'ALTER TABLE `Users` ADD `level_id` INTEGER, ADD CONSTRAINT `Users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            mysql:
              'ALTER TABLE `Users` ADD `level_id` INTEGER, ADD CONSTRAINT `Users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
          },
        );
      });

      it('properly generate alter queries with FIRST', () => {
        return expectsql(
          queryGenerator.addColumnQuery(
            User.table,
            'test_added_col_first',
            current.normalizeAttribute({
              type: DataTypes.STRING,
              first: true,
            }),
          ),
          {
            mariadb: 'ALTER TABLE `Users` ADD `test_added_col_first` VARCHAR(255) FIRST;',
            mysql: 'ALTER TABLE `Users` ADD `test_added_col_first` VARCHAR(255) FIRST;',
          },
        );
      });

      it('properly generates alter queries with column level comment', () => {
        return expectsql(
          queryGenerator.addColumnQuery(
            User.table,
            'column_with_comment',
            current.normalizeAttribute({
              type: DataTypes.STRING,
              comment: 'This is a comment',
            }),
          ),
          {
            mariadb:
              "ALTER TABLE `Users` ADD `column_with_comment` VARCHAR(255) COMMENT 'This is a comment';",
            mysql:
              "ALTER TABLE `Users` ADD `column_with_comment` VARCHAR(255) COMMENT 'This is a comment';",
          },
        );
      });
    }

    it('keeps the default value of an enum column', () => {
      return expectsql(
        queryGenerator.addColumnQuery(
          User.table,
          'level_id',
          current.normalizeAttribute({
            type: DataTypes.ENUM(['pending', 'complete']),
            defaultValue: 'pending',
          }),
        ),
        {
          'mariadb mysql':
            "ALTER TABLE `Users` ADD `level_id` ENUM('pending', 'complete') DEFAULT 'pending';",
          postgres: `DO 'BEGIN CREATE TYPE "public"."enum_Users_level_id" AS ENUM(''pending'', ''complete''); EXCEPTION WHEN duplicate_object THEN null; END';ALTER TABLE "Users" ADD COLUMN  "level_id" "public"."enum_Users_level_id" DEFAULT 'pending';`,
          sqlite3: "ALTER TABLE `Users` ADD `level_id` TEXT DEFAULT 'pending';",
          snowflake: `ALTER TABLE "Users" ADD "level_id" VARCHAR(255) DEFAULT 'pending';`,
          db2: `ALTER TABLE "Users" ADD "level_id" VARCHAR(255) CHECK ("level_id" IN('pending', 'complete')) DEFAULT 'pending';`,
          ibmi: `ALTER TABLE "Users" ADD "level_id" VARCHAR(255) CHECK ("level_id" IN('pending', 'complete')) DEFAULT 'pending'`,
          mssql: `ALTER TABLE [Users] ADD [level_id] NVARCHAR(255) DEFAULT N'pending' CHECK ([level_id] IN(N'pending', N'complete'));`,
          oracle: `ALTER TABLE "Users" ADD "level_id" VARCHAR2(512) DEFAULT 'pending' CHECK ("level_id" IN('pending', 'complete'));`,
        },
      );
    });

    it('defaults the schema to the one set in the Sequelize options', () => {
      const User = customSequelize.define('User', {}, { timestamps: false });

      return expectsql(
        customSql.addColumnQuery(
          User.table,
          'level_id',
          customSequelize.normalizeAttribute({
            type: DataTypes.FLOAT,
            allowNull: false,
          }),
        ),
        {
          'mariadb mysql': 'ALTER TABLE `custom`.`Users` ADD `level_id` FLOAT NOT NULL;',
          postgres: 'ALTER TABLE "custom"."Users" ADD COLUMN "level_id" REAL NOT NULL;',
          sqlite3: 'ALTER TABLE `custom.Users` ADD `level_id` REAL NOT NULL;',
          mssql: 'ALTER TABLE [custom].[Users] ADD [level_id] REAL NOT NULL;',
          db2: 'ALTER TABLE "custom"."Users" ADD "level_id" REAL NOT NULL;',
          snowflake: 'ALTER TABLE "custom"."Users" ADD "level_id" FLOAT NOT NULL;',
          ibmi: 'ALTER TABLE "custom"."Users" ADD "level_id" REAL NOT NULL',
          oracle: 'ALTER TABLE "custom"."Users" ADD "level_id" BINARY_FLOAT NOT NULL;',
        },
      );
    });
  });
});
