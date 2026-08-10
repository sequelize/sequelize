import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('insert', () => {
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
      expectsql(sql.insertQuery(User.tableName, { user_name: 'triggertest' }, User.rawAttributes, options), {
        postgres: 'INSERT INTO "users" ("user_name") VALUES (\'triggertest\') RETURNING "id","user_name";',
        default: "INSERT INTO `users` (`user_name`) VALUES ('triggertest');"
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
        expectsql(sql.insertQuery(User.tableName, { user_name: 'john' }, User.rawAttributes, { returning: true }), {
          postgres: 'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING "id","user_name";',
          default: "INSERT INTO `users` (`user_name`) VALUES ('john');"
        });
      });

      it('restricts the clause to the requested columns', () => {
        expectsql(
          sql.insertQuery(User.tableName, { user_name: 'john' }, User.rawAttributes, { returning: ['user_name'] }),
          {
            postgres: 'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING "user_name";',
            default: "INSERT INTO `users` (`user_name`) VALUES ('john');"
          }
        );
      });

      it('falls back to every column when there is no model to enumerate', () => {
        expectsql(sql.insertQuery(User.tableName, { user_name: 'john' }, undefined, { returning: true }), {
          postgres: 'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING *;',
          default: "INSERT INTO `users` (`user_name`) VALUES ('john');"
        });
      });

      it('falls back to every column for an empty list', () => {
        expectsql(sql.insertQuery(User.tableName, { user_name: 'john' }, User.rawAttributes, { returning: [] }), {
          postgres: 'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING *;',
          default: "INSERT INTO `users` (`user_name`) VALUES ('john');"
        });
      });

      it('returns every column into the exception wrapper, projecting the model columns by name', () => {
        // `INTO response` assigns positionally against the table's row type, so the inner INSERT has
        // to use `RETURNING *`; enumerating the model's columns there shuffles the values whenever
        // the model's attribute order differs from the table's physical column order.
        const query = sql.insertQuery(User.tableName, { user_name: 'john' }, User.rawAttributes, {
          returning: true,
          exception: true
        });

        expectsql(query.replace(/\$func_[0-9a-f]{32}\$/g, '$func$'), {
          postgres:
            'CREATE OR REPLACE FUNCTION pg_temp.testfunc(OUT response "users", OUT sequelize_caught_exception text) RETURNS RECORD AS $func$ ' +
            'BEGIN INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING * INTO response; ' +
            'EXCEPTION WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL; ' +
            'END $func$ LANGUAGE plpgsql; ' +
            'SELECT (testfunc.response)."id", (testfunc.response)."user_name", testfunc.sequelize_caught_exception ' +
            'FROM pg_temp.testfunc(); DROP FUNCTION IF EXISTS pg_temp.testfunc();'
        });
      });

      it('restricts the clause for a bulk insert', () => {
        expectsql(
          sql.bulkInsertQuery(
            User.tableName,
            [{ user_name: 'john' }],
            { returning: ['user_name'] },
            User.rawAttributes
          ),
          {
            postgres: 'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING "user_name";',
            default: "INSERT INTO `users` (`user_name`) VALUES ('john');"
          }
        );
      });
    });
  });

  describe('dates', () => {
    it('formats the date correctly when inserting', () => {
      const timezoneSequelize = Support.createSequelizeInstance({
        timezone: Support.getTestDialect() === 'sqlite' ? '+00:00' : 'CET'
      });

      const User = timezoneSequelize.define(
        'user',
        {
          date: {
            type: DataTypes.DATE
          }
        },
        {
          timestamps: false
        }
      );

      expectsql(
        timezoneSequelize.dialect.QueryGenerator.insertQuery(
          User.tableName,
          { date: new Date(Date.UTC(2015, 0, 20)) },
          User.rawAttributes,
          {}
        ),
        {
          postgres: 'INSERT INTO "users" ("date") VALUES (\'2015-01-20 01:00:00.000 +01:00\');'
        }
      );
    });

    it('formats date correctly when sub-second precision is explicitly specified', () => {
      const timezoneSequelize = Support.createSequelizeInstance({
        timezone: Support.getTestDialect() === 'sqlite' ? '+00:00' : 'CET'
      });

      const User = timezoneSequelize.define(
        'user',
        {
          date: {
            type: DataTypes.DATE(3)
          }
        },
        {
          timestamps: false
        }
      );

      expectsql(
        timezoneSequelize.dialect.QueryGenerator.insertQuery(
          User.tableName,
          { date: new Date(Date.UTC(2015, 0, 20, 1, 2, 3, 89)) },
          User.rawAttributes,
          {}
        ),
        {
          postgres: 'INSERT INTO "users" ("date") VALUES (\'2015-01-20 02:02:03.089 +01:00\');'
        }
      );
    });
  });

  describe('bulkCreate', () => {
    it('bulk create with onDuplicateKeyUpdate', () => {
      const User = Support.sequelize.define(
        'user',
        {
          username: {
            type: DataTypes.STRING,
            field: 'user_name'
          },
          password: {
            type: DataTypes.STRING,
            field: 'pass_word'
          },
          createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
          },
          updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
          }
        },
        {
          timestamps: true
        }
      );

      expectsql(
        sql.bulkInsertQuery(
          User.tableName,
          [{ user_name: 'testuser', pass_word: '12345' }],
          { updateOnDuplicate: ['user_name', 'pass_word', 'updated_at'] },
          User.fieldRawAttributesMap
        ),
        {
          default: "INSERT INTO `users` (`user_name`,`pass_word`) VALUES ('testuser','12345');",
          postgres: 'INSERT INTO "users" ("user_name","pass_word") VALUES (\'testuser\',\'12345\');'
        }
      );
    });
  });
});
