import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';
import sinon from 'sinon';

const expectsql = Support.expectsql;

const current = Support.sequelize;
const Promise = current.Promise;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('changeColumn', () => {
    const Model = current.define(
      'users',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        level_id: {
          type: DataTypes.INTEGER
        }
      },
      { timestamps: false }
    );

    before(function () {
      this.stub = sinon.stub(current, 'query').callsFake((sql) => {
        return Promise.resolve(sql);
      });
    });

    beforeEach(function () {
      this.stub.resetHistory();
    });

    after(function () {
      this.stub.restore();
    });

    it('properly generate alter queries', () => {
      return current
        .getQueryInterface()
        .changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.FLOAT,
          allowNull: false
        })
        .then((sql) => {
          expectsql(sql, {
            postgres:
              'ALTER TABLE "users" ALTER COLUMN "level_id" SET NOT NULL;ALTER TABLE "users" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "users" ALTER COLUMN "level_id" TYPE FLOAT;'
          });
        });
    });

    it('properly generate alter queries for foreign keys', () => {
      return current
        .getQueryInterface()
        .changeColumn(Model.getTableName(), 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        })
        .then((sql) => {
          expectsql(sql, {
            postgres:
              'ALTER TABLE "users"  ADD CONSTRAINT "level_id_foreign_idx" FOREIGN KEY ("level_id") REFERENCES "level" ("id") ON DELETE CASCADE ON UPDATE CASCADE;'
          });
        });
    });
  });
});
