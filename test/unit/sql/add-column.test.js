'use strict';

const Support   = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.queryGenerator;


if (['mysql', 'mariadb'].includes(current.dialect.name)) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('addColumn', () => {

      const Model = current.define('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }, { timestamps: false });

      it('properly generate alter queries', () => {
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'level_id', current.normalizeAttribute({
          type: DataTypes.FLOAT,
          allowNull: false
        })), {
          mariadb: 'ALTER TABLE `users` ADD `level_id` FLOAT NOT NULL;',
          mysql: 'ALTER TABLE `users` ADD `level_id` FLOAT NOT NULL;'
        });
      });

      it('properly generate alter queries for foreign keys', () => {
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'level_id', current.normalizeAttribute({
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        })), {
          mariadb: 'ALTER TABLE `users` ADD `level_id` INTEGER, ADD CONSTRAINT `users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
          mysql: 'ALTER TABLE `users` ADD `level_id` INTEGER, ADD CONSTRAINT `users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;'
        });
      });

      it('properly generate alter queries with FIRST', () => {
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'test_added_col_first', current.normalizeAttribute({
          type: DataTypes.STRING,
          first: true
        })), {
          mariadb: 'ALTER TABLE `users` ADD `test_added_col_first` VARCHAR(255) FIRST;',
          mysql: 'ALTER TABLE `users` ADD `test_added_col_first` VARCHAR(255) FIRST;'
        });
      });

      it('properly generates alter queries with column level comment', () => {
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'column_with_comment', current.normalizeAttribute({
          type: DataTypes.STRING,
          comment: 'This is a comment'
        })), {
          mariadb: 'ALTER TABLE `users` ADD `column_with_comment` VARCHAR(255) COMMENT \'This is a comment\';',
          mysql: 'ALTER TABLE `users` ADD `column_with_comment` VARCHAR(255) COMMENT \'This is a comment\';'
        });
      });
    });
  });
}
