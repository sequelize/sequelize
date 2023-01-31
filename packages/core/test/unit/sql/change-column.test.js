'use strict';

const sinon = require('sinon');
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const expectsql = Support.expectsql;
const current = Support.sequelize;

if (current.dialect.name !== 'sqlite') {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('changeColumn', () => {

      const Model = current.define('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        level_id: {
          type: DataTypes.INTEGER,
        },
      }, { timestamps: false });

      before(function () {
        this.stub = sinon.stub(current, 'queryRaw').resolvesArg(0);
      });

      beforeEach(function () {
        this.stub.resetHistory();
      });

      after(function () {
        this.stub.restore();
      });

      it('properly generate alter queries', () => {
        return current.getQueryInterface().changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.FLOAT,
          allowNull: false,
        }).then(sql => {
          expectsql(sql, {
            ibmi: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET DATA TYPE REAL NOT NULL',
            mssql: 'ALTER TABLE [users] ALTER COLUMN [level_id] REAL NOT NULL;',
            db2: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET DATA TYPE REAL ALTER COLUMN "level_id" SET NOT NULL;',
            mariadb: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            mysql: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            postgres: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE REAL;',
            snowflake: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE FLOAT;',
          });
        });
      });

      it('properly generate alter queries for foreign keys', () => {
        return current.getQueryInterface().changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            table: 'level',
            key: 'id',
          },
          onUpdate: 'cascade',
          onDelete: 'cascade',
        }).then(sql => {
          expectsql(sql, {
            ibmi: 'ALTER TABLE "users" ADD CONSTRAINT "level_id" FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE',
            mssql: 'ALTER TABLE [users] ADD FOREIGN KEY ([level_id]) REFERENCES [level] ([id]) ON DELETE CASCADE;',
            db2: 'ALTER TABLE "users" ADD CONSTRAINT "level_id_foreign_idx" FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE;',
            mariadb: 'ALTER TABLE `users` ADD FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            mysql: 'ALTER TABLE `users` ADD FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            postgres: 'ALTER TABLE "users"  ADD FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;',
            snowflake: 'ALTER TABLE "users"  ADD FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;',
          });
        });
      });

    });
  });
}
