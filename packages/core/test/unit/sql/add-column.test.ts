import { DataTypes } from '@sequelize/core';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const queryGenerator = sequelize.dialect.queryGenerator;

const customSequelize = createSequelizeInstance({
  schema: 'custom',
});
const customSql = customSequelize.dialect.queryGenerator;

describe('QueryGenerator#addColumnQuery', () => {
  const User = sequelize.define('User', {}, { timestamps: false });

  if (['mysql', 'mariadb'].includes(sequelize.dialect.name)) {
    it('properly generate alter queries', () => {
      return expectsql(
        queryGenerator.addColumnQuery(
          User.table,
          'level_id',
          sequelize.normalizeAttribute({
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
          sequelize.normalizeAttribute({
            type: DataTypes.INTEGER,
            references: {
              table: 'level',
              key: 'id',
            },
            // @ts-expect-error -- lowercase referential actions work, but are not typed. See https://github.com/sequelize/sequelize/issues/18567
            onUpdate: 'cascade',
            // @ts-expect-error -- lowercase referential actions work, but are not typed. See https://github.com/sequelize/sequelize/issues/18567
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
          sequelize.normalizeAttribute({
            type: DataTypes.STRING,
            // @ts-expect-error -- "first" is supported by MySQL and MariaDB, but missing from the typings. See https://github.com/sequelize/sequelize/issues/18567
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
          sequelize.normalizeAttribute({
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
    const CustomUser = customSequelize.define('User', {}, { timestamps: false });

    return expectsql(
      customSql.addColumnQuery(
        CustomUser.table,
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
