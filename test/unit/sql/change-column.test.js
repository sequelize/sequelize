'use strict';

const sinon = require('sinon'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  expectsql = Support.expectsql,
  current = Support.sequelize;

if (current.dialect.name !== 'sqlite') {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('changeColumn', () => {

      const Model = current.define('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        level_id: {
          type: DataTypes.INTEGER
        }
      }, { timestamps: false });

      before(function() {

        this.stub = sinon.stub(current, 'query').callsFake(sql => {
          return Promise.resolve(sql);
        });
      });

      beforeEach(function() {
        this.stub.resetHistory();
      });

      after(function() {
        this.stub.restore();
      });

      it('properly generate alter queries', () => {
        return current.getQueryInterface().changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.FLOAT,
          allowNull: false
        }).then(sql => {
          expectsql(sql, {
            mssql: 'ALTER TABLE [users] ALTER COLUMN [level_id] FLOAT NOT NULL;',
            mariadb: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            mysql: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            postgres: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE FLOAT;'
          });
        });
      });

      it('properly generate alter queries for foreign keys', () => {
        return current.getQueryInterface().changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }).then(sql => {
          expectsql(sql, {
            mssql: 'ALTER TABLE [users] ADD FOREIGN KEY ([level_id]) REFERENCES [level] ([id]) ON DELETE CASCADE;',
            mariadb: 'ALTER TABLE `users` ADD FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            mysql: 'ALTER TABLE `users` ADD FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            postgres: 'ALTER TABLE "users"  ADD FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;'
          });
        });
      });

    });
  });
}
