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

    it('DEFAULT VALUE FOR BOOLEAN', () => {
      return expectsql(sql.addColumnQuery(User.getTableName(), 'bool_col', current.normalizeAttribute({
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      })), {
        oracle: 'ALTER TABLE "Users" ADD "bool_col" CHAR(1) DEFAULT 1 NOT NULL CHECK ("bool_col" IN(\'1\', \'0\'))',
        mysql: 'ALTER TABLE `Users` ADD `bool_col` TINYINT(1) NOT NULL DEFAULT true;',
        mariadb: 'ALTER TABLE `Users` ADD `bool_col` TINYINT(1) NOT NULL DEFAULT true;',
        mssql: 'ALTER TABLE [Users] ADD [bool_col] BIT NOT NULL DEFAULT 1;',
        postgres: 'ALTER TABLE "public"."Users" ADD COLUMN "bool_col" BOOLEAN NOT NULL DEFAULT true;',
        db2: 'ALTER TABLE "Users" ADD "bool_col" BOOLEAN NOT NULL DEFAULT true;',
        snowflake: 'ALTER TABLE "Users" ADD "bool_col" BOOLEAN NOT NULL DEFAULT true;',
        sqlite: 'ALTER TABLE `Users` ADD `bool_col` TINYINT(1) NOT NULL DEFAULT 1;'
      });
    });

    it('DEFAULT VALUE FOR ENUM', () => {
      return expectsql(sql.addColumnQuery(User.getTableName(), 'enum_col', current.normalizeAttribute({
        type: DataTypes.ENUM('happy', 'sad'),
        allowNull: false,
        defaultValue: 'happy'
      })), {
        oracle: 'ALTER TABLE "Users" ADD "enum_col" VARCHAR2(512) DEFAULT \'happy\' NOT NULL CHECK ("enum_col" IN(\'happy\', \'sad\'))',
        mysql: 'ALTER TABLE `Users` ADD `enum_col` ENUM(\'happy\', \'sad\') NOT NULL DEFAULT \'happy\';',
        mariadb: 'ALTER TABLE `Users` ADD `enum_col` ENUM(\'happy\', \'sad\') NOT NULL DEFAULT \'happy\';',
        mssql: 'ALTER TABLE [Users] ADD [enum_col] VARCHAR(255) CHECK ([enum_col] IN(N\'happy\', N\'sad\'));',
        postgres: 'DO \'BEGIN CREATE TYPE "public"."enum_Users_enum_col" AS ENUM(\'\'happy\'\', \'\'sad\'\'); EXCEPTION WHEN duplicate_object THEN null; END\';ALTER TABLE "public"."Users" ADD COLUMN "enum_col" "public"."enum_Users_enum_col" NOT NULL DEFAULT \'happy\';',
        db2: 'ALTER TABLE "Users" ADD "enum_col" VARCHAR(255) CHECK ("enum_col" IN(\'happy\', \'sad\')) NOT NULL DEFAULT \'happy\';',
        snowflake: 'ALTER TABLE "Users" ADD "enum_col" ENUM NOT NULL DEFAULT \'happy\';',
        sqlite: 'ALTER TABLE `Users` ADD `enum_col` TEXT NOT NULL DEFAULT \'happy\';'
      });
    });

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
