'use strict';

const { beforeAll2, expectsql, sequelize } = require('../../../support');
const { DataTypes } = require('@sequelize/core');
const { expect } = require('chai');

const sql = sequelize.dialect.queryGenerator;

describe('PostgresQueryGenerator', () => {
  if (sequelize.dialect.name !== 'postgres') {
    return;
  }

  const vars = beforeAll2(() => {
    const FooUser = sequelize.define(
      'user',
      {
        mood: DataTypes.ENUM('happy', 'sad'),
      },
      {
        schema: 'foo',
      },
    );

    const PublicUser = sequelize.define('user', {
      mood: {
        type: DataTypes.ENUM('happy', 'sad'),
        field: 'theirMood',
      },
    });

    return { FooUser, PublicUser };
  });

  describe('pgEnumName', () => {
    it('does not add schema when options: { schema: false }', () => {
      const { FooUser, PublicUser } = vars;

      expect(sql.pgEnumName(PublicUser.table, 'mood', { schema: false })).to.equal(
        '"enum_users_mood"',
      );
      expect(sql.pgEnumName(FooUser.table, 'theirMood', { schema: false })).to.equal(
        '"enum_users_theirMood"',
      );
    });

    it('properly quotes both the schema and the enum name', () => {
      const { FooUser, PublicUser } = vars;

      expect(
        sql.pgEnumName(PublicUser.table, 'mood', PublicUser.getAttributes().mood.type),
      ).to.equal('"public"."enum_users_mood"');
      expect(
        sql.pgEnumName(FooUser.table, 'theirMood', FooUser.getAttributes().mood.type),
      ).to.equal('"foo"."enum_users_theirMood"');
    });
  });

  describe('pgEnum', () => {
    it('uses schema #3171', () => {
      const { FooUser } = vars;

      expectsql(sql.pgEnum(FooUser.table, 'mood', FooUser.getAttributes().mood.type), {
        postgres: `DO 'BEGIN CREATE TYPE "foo"."enum_users_mood" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
      });
    });

    it('does add schema when public', () => {
      const { PublicUser } = vars;

      expectsql(sql.pgEnum(PublicUser.table, 'theirMood', PublicUser.getAttributes().mood.type), {
        postgres: `DO 'BEGIN CREATE TYPE "public"."enum_users_theirMood" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
      });
    });
  });

  describe('pgEnumAdd', () => {
    it('creates alter type with exists', () => {
      const { PublicUser } = vars;

      expectsql(sql.pgEnumAdd(PublicUser.table, 'mood', 'neutral', { after: 'happy' }), {
        postgres:
          'ALTER TYPE "public"."enum_users_mood" ADD VALUE IF NOT EXISTS \'neutral\' AFTER \'happy\'',
      });
    });
  });

  describe('pgListEnums', () => {
    it('works with schema #3563', () => {
      const { FooUser } = vars;

      expectsql(sql.pgListEnums(FooUser.table, 'mood'), {
        postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'foo'
                     AND t.typname='enum_users_mood'
                   GROUP BY 1`,
      });
    });

    it('uses the default schema if no options given', () => {
      expectsql(sql.pgListEnums(), {
        postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public'
                   GROUP BY 1`,
      });
    });

    it('is not vulnerable to sql injection', () => {
      expectsql(sql.pgListEnums({ tableName: `ta'"ble`, schema: `sche'"ma` }, `attri'"bute`), {
        postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'sche''"ma'
                     AND t.typname='enum_ta''"ble_attri''"bute'
                   GROUP BY 1`,
      });
    });
  });
});
