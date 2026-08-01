'use strict';

const Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator,
  _ = require('lodash');

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('createTable', () => {
    const FooUser = current.define(
      'user',
      {
        mood: DataTypes.ENUM('happy', 'sad')
      },
      {
        schema: 'foo',
        timestamps: false
      }
    );
    describe('with enums', () => {
      it('references enum in the right schema #3171', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), {}), {
          postgres:
            'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
        });
      });
    });

    describe('IF NOT EXISTS', () => {
      it('always includes IF NOT EXISTS', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), {}), {
          postgres:
            'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
        });
      });
    });

    describe('Attempt to use different lodash template settings', () => {
      before(() => {
        // make handlebars
        _.templateSettings.evaluate = /{{([\s\S]+?)}}/g;
        _.templateSettings.interpolate = /{{=([\s\S]+?)}}/g;
        _.templateSettings.escape = /{{-([\s\S]+?)}}/g;
      });

      after(() => {
        // reset
        const __ = require('lodash').runInContext();
        _.templateSettings.evaluate = __.templateSettings.evaluate;
        _.templateSettings.interpolate = __.templateSettings.interpolate;
        _.templateSettings.escape = __.templateSettings.escape;
      });

      it('it should be a okay!', () => {
        expectsql(
          sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), {
            comment: 'This is a test of the lodash template settings.'
          }),
          {
            postgres:
              'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id")); COMMENT ON TABLE "foo"."users" IS \'This is a test of the lodash template settings.\';'
          }
        );
      });
    });
  });
});
