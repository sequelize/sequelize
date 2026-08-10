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
