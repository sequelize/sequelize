'use strict';

/* jshint -W030, -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require('../../../lib/data-types')
  , expectsql = Support.expectsql
  , sinon = require('sinon')
  , current   = Support.sequelize
  , Promise = current.Promise;


if (current.dialect.name === 'mysql') {
  describe(Support.getTestDialectTeaser('SQL'), function() {
    describe('addColumn', function () {

      var Model = current.define('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        level_id: {
          type: DataTypes.INTEGER
        }
      }, { timestamps: false });

      before(function () {

        this.stub = sinon.stub(current, 'query', function (sql) {
          return Promise.resolve(sql);
        });
      });

      beforeEach(function () {
        this.stub.reset();
      });

      after(function () {
        this.stub.restore();
      });

      it('properly generate alter queries', function(){
        return current.getQueryInterface().addColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.FLOAT,
          allowNull: false,
        }).then(function(sql){
          expectsql(sql, {
            mysql: 'ALTER TABLE `users` ADD `level_id` FLOAT NOT NULL;',
          });
        });
      });

      it('properly generate alter queries for foreign keys', function(){
        return current.getQueryInterface().addColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key:   'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }).then(function(sql){
          expectsql(sql, {
            mysql: 'ALTER TABLE `users` ADD `level_id` INTEGER, ADD CONSTRAINT `level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
          });
        });
      });

    });
  });
}
