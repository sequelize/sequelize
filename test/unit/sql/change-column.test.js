'use strict';

/* jshint -W030, -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require('../../../lib/data-types')
  , expectsql = Support.expectsql
  , sinon = require('sinon')
  , current   = Support.sequelize
  , Promise = current.Promise;


if (current.dialect.name !== 'sqlite') {
  describe(Support.getTestDialectTeaser('SQL'), function() {
    describe('changeColumn', function () {

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
        return current.getQueryInterface().changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.FLOAT,
          allowNull: false,
        }).then(function(sql){
          expectsql(sql, {
            mssql: 'ALTER TABLE [users] ALTER COLUMN [level_id] FLOAT NOT NULL;',
            mysql: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            postgres: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE FLOAT;',
          });
        });
      });

      it('properly generate alter queries for foreign keys', function(){
        return current.getQueryInterface().changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key:   'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }).then(function(sql){
          expectsql(sql, {
            mssql: 'ALTER TABLE [users] ADD CONSTRAINT [level_id_foreign_idx] FOREIGN KEY ([level_id]) REFERENCES [level] ([id]) ON DELETE CASCADE;',
            mysql: 'ALTER TABLE `users` ADD CONSTRAINT `level_id_foreign_idx` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            postgres: 'ALTER TABLE "users"  ADD CONSTRAINT "level_id_foreign_idx" FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;',
          });
        });
      });

    });
  });
}
