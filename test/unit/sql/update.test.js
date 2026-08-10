import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('update', () => {
    it('with temp table for trigger', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name'
          }
        },
        {
          timestamps: false,
          hasTrigger: true
        }
      );

      const options = {
        returning: true,
        hasTrigger: true
      };
      expectsql(sql.updateQuery(User.tableName, { user_name: 'triggertest' }, { id: 2 }, options, User.rawAttributes), {
        postgres: 'UPDATE "users" SET "user_name"=\'triggertest\' WHERE "id" = 2 RETURNING "id","user_name"',
        default: "UPDATE `users` SET `user_name`='triggertest' WHERE `id` = 2"
      });
    });

    describe('returning', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name'
          },
          displayName: {
            type: DataTypes.VIRTUAL,
            get() {
              return this.username;
            }
          }
        },
        { timestamps: false }
      );

      it('returns the model columns, skipping virtual attributes', () => {
        expectsql(
          sql.updateQuery(User.tableName, { user_name: 'john' }, { id: 2 }, { returning: true }, User.tableAttributes),
          {
            postgres: 'UPDATE "users" SET "user_name"=\'john\' WHERE "id" = 2 RETURNING "id","user_name"',
            default: "UPDATE `users` SET `user_name`='john' WHERE `id` = 2"
          }
        );
      });

      it('restricts the clause to the requested columns', () => {
        expectsql(
          sql.updateQuery(
            User.tableName,
            { user_name: 'john' },
            { id: 2 },
            { returning: ['user_name'] },
            User.tableAttributes
          ),
          {
            postgres: 'UPDATE "users" SET "user_name"=\'john\' WHERE "id" = 2 RETURNING "user_name"',
            default: "UPDATE `users` SET `user_name`='john' WHERE `id` = 2"
          }
        );
      });

      it('falls back to every column when there is no model to enumerate', () => {
        expectsql(sql.updateQuery(User.tableName, { user_name: 'john' }, { id: 2 }, { returning: true }), {
          postgres: 'UPDATE "users" SET "user_name"=\'john\' WHERE "id" = 2 RETURNING *',
          default: "UPDATE `users` SET `user_name`='john' WHERE `id` = 2"
        });
      });
    });

    it('Works with limit', () => {
      const User = Support.sequelize.define(
        'User',
        {
          username: {
            type: DataTypes.STRING
          },
          userId: {
            type: DataTypes.INTEGER
          }
        },
        {
          timestamps: false
        }
      );

      expectsql(sql.updateQuery(User.tableName, { username: 'new.username' }, { username: 'username' }, { limit: 1 }), {
        default: "UPDATE [Users] SET [username]='new.username' WHERE [username] = 'username'"
      });
    });
  });
});
