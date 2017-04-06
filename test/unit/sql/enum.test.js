'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator,
  expect    = require('chai').expect;


describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('enum', () => {
    if (Support.getTestDialect() === 'postgres') {
      const FooUser = current.define('user', {
        mood: DataTypes.ENUM('happy', 'sad')
      }, {
        schema: 'foo'
      });

      const PublicUser = current.define('user', {
        mood: {
          type: DataTypes.ENUM('happy', 'sad'),
          field: 'theirMood'
        }
      });

      describe('pgEnumName', () => {
        it('does not add schema when options: { schema: false }', () => {
          expect(sql.pgEnumName(PublicUser.getTableName(), 'mood', { schema: false }))
            .to.equal('"enum_users_mood"');
          expect(sql.pgEnumName(FooUser.getTableName(), 'theirMood', { schema: false }))
            .to.equal('"enum_users_theirMood"');
        });

        it('properly quotes both the schema and the enum name', () => {
          expect(sql.pgEnumName(PublicUser.getTableName(), 'mood', PublicUser.rawAttributes.mood.type))
            .to.equal('"public"."enum_users_mood"');
          expect(sql.pgEnumName(FooUser.getTableName(), 'theirMood', FooUser.rawAttributes.mood.type))
            .to.equal('"foo"."enum_users_theirMood"');
        });
      });

      describe('pgEnum', () => {
        it('uses schema #3171', () => {
          expectsql(sql.pgEnum(FooUser.getTableName(), 'mood', FooUser.rawAttributes.mood.type), {
            postgres: 'CREATE TYPE "foo"."enum_users_mood" AS ENUM(\'happy\', \'sad\');'
          });
        });

        it('does add schema when public', () => {
          expectsql(sql.pgEnum(PublicUser.getTableName(), 'theirMood', PublicUser.rawAttributes.mood.type), {
            postgres: 'CREATE TYPE "public"."enum_users_theirMood" AS ENUM(\'happy\', \'sad\');'
          });
        });
      });

      describe('pgEnumAdd', () => {
        it('creates alter type with exists on 9.4', () => {
          current.options.databaseVersion = '9.4.0';
          expectsql(sql.pgEnumAdd(PublicUser.getTableName(), 'mood', 'neutral', { after: 'happy' }), {
            postgres: 'ALTER TYPE "public"."enum_users_mood" ADD VALUE IF NOT EXISTS \'neutral\' AFTER \'happy\''
          });
        });

        it('creates alter type without exists on 9.2 ', () => {
          current.options.databaseVersion = '9.2.0';
          expectsql(sql.pgEnumAdd(PublicUser.getTableName(), 'mood', 'neutral', { after: 'happy' }), {
            postgres: 'ALTER TYPE "public"."enum_users_mood" ADD VALUE \'neutral\' AFTER \'happy\''
          });
        });
      });

      describe('pgListEnums', () => {
        it('works with schema #3563', () => {
          expectsql(sql.pgListEnums(FooUser.getTableName(), 'mood'), {
            postgres: 'SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = \'foo\' AND t.typname=\'enum_users_mood\' GROUP BY 1'
          });
        });

        it('uses the default schema if no options given', () => {
          expectsql(sql.pgListEnums(), {
            postgres: 'SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = \'public\' GROUP BY 1'
          });
        });
      });
    }
  });
});

