'use strict';

const Support   = require('../support');
const DataTypes = require('sequelize/lib/data-types');

const expectsql = Support.expectsql;
const current   = Support.sequelize;
const sql       = current.dialect.queryGenerator;

const customSequelize = Support.createSequelizeInstance({
  schema: 'custom'
});
const customSql = customSequelize.dialect.queryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('addColumn', () => {
    const User = current.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }
    }, { timestamps: false });
    if (['mysql', 'mariadb'].includes(current.dialect.name)) {

      it('properly generate alter queries', () => {
        return expectsql(sql.addColumnQuery(User.getTableName(), 'level_id', current.normalizeAttribute({
          type: DataTypes.FLOAT,
          allowNull: false
        })), {
          mariadb: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;',
          mysql: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;'
        });
      });

      it('properly generate alter queries for foreign keys', () => {
        return expectsql(sql.addColumnQuery(User.getTableName(), 'level_id', current.normalizeAttribute({
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        })), {
          mariadb: 'ALTER TABLE `Users` ADD `level_id` INTEGER, ADD CONSTRAINT `Users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
          mysql: 'ALTER TABLE `Users` ADD `level_id` INTEGER, ADD CONSTRAINT `Users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;'
        });
      });

      it('properly generate alter queries with FIRST', () => {
        return expectsql(sql.addColumnQuery(User.getTableName(), 'test_added_col_first', current.normalizeAttribute({
          type: DataTypes.STRING,
          first: true
        })), {
          mariadb: 'ALTER TABLE `Users` ADD `test_added_col_first` VARCHAR(255) FIRST;',
          mysql: 'ALTER TABLE `Users` ADD `test_added_col_first` VARCHAR(255) FIRST;'
        });
      });

      it('properly generates alter queries with column level comment', () => {
        return expectsql(sql.addColumnQuery(User.getTableName(), 'column_with_comment', current.normalizeAttribute({
          type: DataTypes.STRING,
          comment: 'This is a comment'
        })), {
          mariadb: 'ALTER TABLE `Users` ADD `column_with_comment` VARCHAR(255) COMMENT \'This is a comment\';',
          mysql: 'ALTER TABLE `Users` ADD `column_with_comment` VARCHAR(255) COMMENT \'This is a comment\';'
        });
      });
    }

    it('defaults the schema to the one set in the Sequelize options', () => {
      return expectsql(customSql.addColumnQuery(User.getTableName(), 'level_id', customSequelize.normalizeAttribute({
        type: DataTypes.FLOAT,
        allowNull: false
      })), {
        mariadb: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;',
        mysql: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;',
        postgres: 'ALTER TABLE "custom"."Users" ADD COLUMN "level_id" FLOAT NOT NULL;',
        sqlite: 'ALTER TABLE `Users` ADD `level_id` FLOAT NOT NULL;',
        mssql: 'ALTER TABLE [Users] ADD [level_id] FLOAT NOT NULL;',
        db2: 'ALTER TABLE "Users" ADD "level_id" FLOAT NOT NULL;',
        snowflake: 'ALTER TABLE "Users" ADD "level_id" FLOAT NOT NULL;',
        oracle: 'ALTER TABLE "Users" ADD "level_id" BINARY_FLOAT NOT NULL'
      });
    });
  });
});
