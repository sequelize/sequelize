'use strict';

const sinon = require('sinon'),
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
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
        this.stub = sinon.stub(current, 'query').resolvesArg(0);
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
            db2: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET DATA TYPE FLOAT ALTER COLUMN "level_id" SET NOT NULL;',
            mariadb: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            mysql: 'ALTER TABLE `users` CHANGE `level_id` `level_id` FLOAT NOT NULL;',
            postgres: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE FLOAT;',
            oracle: 'DECLARE CONS_NAME VARCHAR2(200); BEGIN BEGIN EXECUTE IMMEDIATE \'ALTER TABLE "users" MODIFY "level_id" BINARY_FLOAT NOT NULL\'; EXCEPTION WHEN OTHERS THEN  IF SQLCODE = -1442 OR SQLCODE = -1451 THEN    EXECUTE IMMEDIATE \'ALTER TABLE "users" MODIFY "level_id" BINARY_FLOAT \';  ELSE    RAISE;  END IF; END; END;',
            snowflake: 'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE FLOAT;'
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
            oracle: 'DECLARE CONS_NAME VARCHAR2(200); BEGIN BEGIN SELECT constraint_name INTO cons_name FROM (SELECT DISTINCT cc.owner, cc.table_name, cc.constraint_name, cc.column_name AS cons_columns FROM all_cons_columns cc, all_constraints c WHERE cc.owner = c.owner AND cc.table_name = c.table_name AND cc.constraint_name = c.constraint_name AND c.constraint_type = \'R\' GROUP BY cc.owner, cc.table_name, cc.constraint_name, cc.column_name) WHERE owner = USER AND table_name = \'users\' AND cons_columns = \'level_id\' ; EXCEPTION WHEN NO_DATA_FOUND THEN CONS_NAME := NULL; END; IF CONS_NAME IS NOT NULL THEN EXECUTE IMMEDIATE \'ALTER TABLE "users" DROP CONSTRAINT "\'||CONS_NAME||\'"\'; END IF; EXECUTE IMMEDIATE \'ALTER TABLE "users" ADD FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE\'; END;',
            mssql: 'ALTER TABLE [users] ADD FOREIGN KEY ([level_id]) REFERENCES [level] ([id]) ON DELETE CASCADE;',
            db2: 'ALTER TABLE "users" ADD CONSTRAINT "level_id_foreign_idx" FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE;',
            mariadb: 'ALTER TABLE `users` ADD FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            mysql: 'ALTER TABLE `users` ADD FOREIGN KEY (`level_id`) REFERENCES `level` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;',
            postgres: 'ALTER TABLE "users"  ADD FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;',
            snowflake: 'ALTER TABLE "users"  ADD FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;'
          });
        });
      });

    });
  });
}
