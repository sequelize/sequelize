'use strict';

const { beforeAll2, expectsql, sequelize } = require('../../../support');
const { DataTypes } = require('@sequelize/core');
const { expect } = require('chai');

const queryGenerator = sequelize.dialect.queryGenerator;

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

    const CustomEnumUser = sequelize.define('user', {
      mood: DataTypes.ENUM({ values: ['happy', 'sad'], name: 'mood_type' }),
    });

    const CustomEnumSchemaUser = sequelize.define(
      'user',
      {
        mood: DataTypes.ENUM({
          values: ['happy', 'sad'],
          name: 'mood_type',
          schema: 'shared',
        }),
      },
      { schema: 'foo' },
    );

    // schema only (no name) — uses auto-generated name but with custom schema
    const EnumSchemaOnlyUser = sequelize.define(
      'user',
      {
        mood: DataTypes.ENUM({ values: ['happy', 'sad'], schema: 'shared' }),
      },
      { schema: 'foo' },
    );

    return { FooUser, PublicUser, CustomEnumUser, CustomEnumSchemaUser, EnumSchemaOnlyUser };
  });

  describe('pgEnumName', () => {
    it('does not add schema when options: { schema: false }', () => {
      const { FooUser, PublicUser } = vars;

      expect(queryGenerator.pgEnumName(PublicUser.table, 'mood', { schema: false })).to.equal(
        '"enum_users_mood"',
      );
      expect(queryGenerator.pgEnumName(FooUser.table, 'theirMood', { schema: false })).to.equal(
        '"enum_users_theirMood"',
      );
    });

    it('properly quotes both the schema and the enum name', () => {
      const { FooUser, PublicUser } = vars;

      expect(
        queryGenerator.pgEnumName(PublicUser.table, 'mood', PublicUser.getAttributes().mood.type),
      ).to.equal('"public"."enum_users_mood"');
      expect(
        queryGenerator.pgEnumName(FooUser.table, 'theirMood', FooUser.getAttributes().mood.type),
      ).to.equal('"foo"."enum_users_theirMood"');
    });

    it('uses enumName when provided', () => {
      const { PublicUser } = vars;

      expect(
        queryGenerator.pgEnumName(PublicUser.table, 'mood', { enumName: 'mood_type' }),
      ).to.equal('"public"."mood_type"');
    });

    it('uses enumSchema when provided', () => {
      const { PublicUser } = vars;

      expect(
        queryGenerator.pgEnumName(PublicUser.table, 'mood', {
          enumName: 'mood_type',
          enumSchema: 'shared',
        }),
      ).to.equal('"shared"."mood_type"');
    });

    it('uses enumSchema with auto-generated name when only enumSchema is provided', () => {
      const { PublicUser } = vars;

      expect(
        queryGenerator.pgEnumName(PublicUser.table, 'mood', { enumSchema: 'shared' }),
      ).to.equal('"shared"."enum_users_mood"');
    });
  });

  describe('pgEnum', () => {
    it('uses schema #3171', () => {
      const { FooUser } = vars;

      expectsql(queryGenerator.pgEnum(FooUser.table, 'mood', FooUser.getAttributes().mood.type), {
        postgres: `DO 'BEGIN CREATE TYPE "foo"."enum_users_mood" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
      });
    });

    it('does add schema when public', () => {
      const { PublicUser } = vars;

      expectsql(
        queryGenerator.pgEnum(PublicUser.table, 'theirMood', PublicUser.getAttributes().mood.type),
        {
          postgres: `DO 'BEGIN CREATE TYPE "public"."enum_users_theirMood" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
        },
      );
    });

    it('uses custom enumName', () => {
      const { CustomEnumUser } = vars;

      expectsql(
        queryGenerator.pgEnum(
          CustomEnumUser.table,
          'mood',
          CustomEnumUser.getAttributes().mood.type,
        ),
        {
          postgres: `DO 'BEGIN CREATE TYPE "public"."mood_type" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
        },
      );
    });

    it('uses custom enumName and enumSchema', () => {
      const { CustomEnumSchemaUser } = vars;

      expectsql(
        queryGenerator.pgEnum(
          CustomEnumSchemaUser.table,
          'mood',
          CustomEnumSchemaUser.getAttributes().mood.type,
        ),
        {
          postgres: `DO 'BEGIN CREATE TYPE "shared"."mood_type" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
        },
      );
    });

    it('uses enumSchema with auto-generated name when only enumSchema is provided', () => {
      const { EnumSchemaOnlyUser } = vars;

      expectsql(
        queryGenerator.pgEnum(
          EnumSchemaOnlyUser.table,
          'mood',
          EnumSchemaOnlyUser.getAttributes().mood.type,
        ),
        {
          postgres: `DO 'BEGIN CREATE TYPE "shared"."enum_users_mood" AS ENUM(''happy'', ''sad''); EXCEPTION WHEN duplicate_object THEN null; END';`,
        },
      );
    });
  });

  describe('attributeToSQL (ENUM column type reference in CREATE TABLE)', () => {
    it('uses enumSchema with auto-generated name when only enumSchema is provided', () => {
      const { EnumSchemaOnlyUser } = vars;
      const moodAttr = EnumSchemaOnlyUser.modelDefinition.attributes.get('mood');

      const result = queryGenerator.attributeToSQL(
        { type: moodAttr.type },
        { table: EnumSchemaOnlyUser.table, key: 'mood' },
      );
      expect(result).to.equal('"shared"."enum_users_mood"');
    });

    it('uses custom enumName and enumSchema for column type reference', () => {
      const { CustomEnumSchemaUser } = vars;
      const moodAttr = CustomEnumSchemaUser.modelDefinition.attributes.get('mood');

      const result = queryGenerator.attributeToSQL(
        { type: moodAttr.type },
        { table: CustomEnumSchemaUser.table, key: 'mood' },
      );
      expect(result).to.equal('"shared"."mood_type"');
    });
  });

  describe('pgEnumAdd', () => {
    it('creates alter type with exists', () => {
      const { PublicUser } = vars;

      expectsql(queryGenerator.pgEnumAdd(PublicUser.table, 'mood', 'neutral', { after: 'happy' }), {
        postgres:
          'ALTER TYPE "public"."enum_users_mood" ADD VALUE IF NOT EXISTS \'neutral\' AFTER \'happy\'',
      });
    });

    it('uses custom enumName', () => {
      const { PublicUser } = vars;

      expectsql(
        queryGenerator.pgEnumAdd(PublicUser.table, 'mood', 'neutral', {
          after: 'happy',
          enumName: 'mood_type',
        }),
        {
          postgres:
            'ALTER TYPE "public"."mood_type" ADD VALUE IF NOT EXISTS \'neutral\' AFTER \'happy\'',
        },
      );
    });

    it('uses custom enumName and enumSchema', () => {
      const { PublicUser } = vars;

      expectsql(
        queryGenerator.pgEnumAdd(PublicUser.table, 'mood', 'neutral', {
          after: 'happy',
          enumName: 'mood_type',
          enumSchema: 'shared',
        }),
        {
          postgres:
            'ALTER TYPE "shared"."mood_type" ADD VALUE IF NOT EXISTS \'neutral\' AFTER \'happy\'',
        },
      );
    });
  });

  describe('pgListEnums', () => {
    it('works with schema #3563', () => {
      const { FooUser } = vars;

      expectsql(queryGenerator.pgListEnums(FooUser.table, 'mood'), {
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
      expectsql(queryGenerator.pgListEnums(), {
        postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public'
                   GROUP BY 1`,
      });
    });

    it('is not vulnerable to sql injection', () => {
      expectsql(
        queryGenerator.pgListEnums({ tableName: `ta'"ble`, schema: `sche'"ma` }, `attri'"bute`),
        {
          postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'sche''"ma'
                     AND t.typname='enum_ta''"ble_attri''"bute'
                   GROUP BY 1`,
        },
      );
    });

    it('uses custom enumName for type filter', () => {
      const { FooUser } = vars;

      expectsql(queryGenerator.pgListEnums(FooUser.table, 'mood', { enumName: 'mood_type' }), {
        postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'foo'
                     AND t.typname='mood_type'
                   GROUP BY 1`,
      });
    });

    it('uses enumSchema for schema filter', () => {
      const { FooUser } = vars;

      expectsql(
        queryGenerator.pgListEnums(FooUser.table, 'mood', {
          enumName: 'mood_type',
          enumSchema: 'shared',
        }),
        {
          postgres: `SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value
                   FROM pg_type t
                          JOIN pg_enum e ON t.oid = e.enumtypid
                          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'shared'
                     AND t.typname='mood_type'
                   GROUP BY 1`,
        },
      );
    });
  });
});
