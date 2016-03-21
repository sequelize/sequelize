'use strict';

/* jshint -W030, -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require('../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;


if (current.dialect.name === 'mysql') {
  describe(Support.getTestDialectTeaser('SQL'), function() {
    describe('addColumn', function () {

      var Model = current.define('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }, { timestamps: false });

      it('properly generate alter queries', function(){
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'level_id', current.normalizeAttribute({
          type: DataTypes.FLOAT,
          allowNull: false,
        })), {
            mysql: 'ALTER TABLE `users` ADD `level_id` FLOAT NOT NULL;',
        });
      });

      it('properly generate alter queries for foreign keys', function(){
        return expectsql(sql.addColumnQuery(Model.getTableName(), 'level_id', current.normalizeAttribute({
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key:   'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        })), {
            mysql: 'ALTER TABLE `users` ADD `level_id` INTEGER, ADD CONSTRAINT `level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
        });
      });

    });
  });
}
