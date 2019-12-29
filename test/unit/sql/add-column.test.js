'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require('../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;


if (current.dialect.name === 'mysql') {
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
          mysql: 'ALTER TABLE `users` ADD `level_id` INTEGER, ADD CONSTRAINT `users_level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;'
        });
      });

      it('properly generate alter queries with FIRST', () => {
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'test_added_col_first', current.normalizeAttribute({
          type: DataTypes.STRING,
          first: true
        })), {
          mysql: 'ALTER TABLE `users` ADD `test_added_col_first` VARCHAR(255) FIRST;'
        });
      });
    });
  });
}
