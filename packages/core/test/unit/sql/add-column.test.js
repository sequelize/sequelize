'use strict';

const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.queryGenerator;

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
          sql.addColumnQuery(
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
          sql.addColumnQuery(
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
          sql.addColumnQuery(
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
          sql.addColumnQuery(
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
        },
      );
    });
  });
});
