import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('upsert', () => {
    const User = Support.sequelize.define(
      'user',
      {
        username: {
          type: DataTypes.STRING,
          field: 'user_name'
        }
      },
      { timestamps: false }
    );

    // The insert and the update both have to land their primary key in the function's `primary_key`
    // OUT parameter -- a RETURNING clause without an INTO is a plpgsql error, so these assertions
    // exist to catch the clause and the redirect drifting apart.
    it('returns the primary key into the OUT parameter', () => {
      expectsql(
        sql.upsertQuery(User.tableName, { user_name: 'john' }, { user_name: 'jane' }, { id: 2 }, User, {
          returning: true
        }),
        {
          postgres:
            'CREATE OR REPLACE FUNCTION pg_temp.sequelize_upsert(OUT created boolean, OUT primary_key text)  AS $func$ BEGIN ' +
            'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING "id" INTO primary_key; created := true; ' +
            'EXCEPTION WHEN unique_violation THEN UPDATE "users" SET "user_name"=\'jane\' WHERE "id" = 2 RETURNING "id" INTO primary_key; created := false; ' +
            'END; $func$ LANGUAGE plpgsql; SELECT * FROM pg_temp.sequelize_upsert();'
        }
      );
    });

    it('omits the returning clause entirely when returning is not requested', () => {
      expectsql(
        sql.upsertQuery(User.tableName, { user_name: 'john' }, { user_name: 'jane' }, { id: 2 }, User, {
          returning: false
        }),
        {
          postgres:
            'CREATE OR REPLACE FUNCTION pg_temp.sequelize_upsert(OUT created boolean, OUT primary_key text)  AS $func$ BEGIN ' +
            'INSERT INTO "users" ("user_name") VALUES (\'john\'); created := true; ' +
            'EXCEPTION WHEN unique_violation THEN UPDATE "users" SET "user_name"=\'jane\' WHERE "id" = 2; created := false; ' +
            'END; $func$ LANGUAGE plpgsql; SELECT * FROM pg_temp.sequelize_upsert();'
        }
      );
    });

    it('ignores a caller supplied returning list', () => {
      expectsql(
        sql.upsertQuery(User.tableName, { user_name: 'john' }, { user_name: 'jane' }, { id: 2 }, User, {
          returning: ['user_name']
        }),
        {
          postgres:
            'CREATE OR REPLACE FUNCTION pg_temp.sequelize_upsert(OUT created boolean, OUT primary_key text)  AS $func$ BEGIN ' +
            'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING "id" INTO primary_key; created := true; ' +
            'EXCEPTION WHEN unique_violation THEN UPDATE "users" SET "user_name"=\'jane\' WHERE "id" = 2 RETURNING "id" INTO primary_key; created := false; ' +
            'END; $func$ LANGUAGE plpgsql; SELECT * FROM pg_temp.sequelize_upsert();'
        }
      );
    });

    it('uses the column a custom primary key is stored under', () => {
      const CustomUser = Support.sequelize.define(
        'customUser',
        {
          userId: {
            type: DataTypes.INTEGER,
            field: 'user_id',
            primaryKey: true,
            autoIncrement: true
          },
          username: {
            type: DataTypes.STRING,
            field: 'user_name'
          }
        },
        { timestamps: false, tableName: 'users' }
      );

      expectsql(
        sql.upsertQuery(
          CustomUser.tableName,
          { user_name: 'john' },
          { user_name: 'jane' },
          { user_id: 2 },
          CustomUser,
          { returning: true }
        ),
        {
          postgres:
            'CREATE OR REPLACE FUNCTION pg_temp.sequelize_upsert(OUT created boolean, OUT primary_key text)  AS $func$ BEGIN ' +
            'INSERT INTO "users" ("user_name") VALUES (\'john\') RETURNING "user_id" INTO primary_key; created := true; ' +
            'EXCEPTION WHEN unique_violation THEN UPDATE "users" SET "user_name"=\'jane\' WHERE "user_id" = 2 RETURNING "user_id" INTO primary_key; created := false; ' +
            'END; $func$ LANGUAGE plpgsql; SELECT * FROM pg_temp.sequelize_upsert();'
        }
      );
    });
  });
});
