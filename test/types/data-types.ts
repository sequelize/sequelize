import { expectTypeOf } from 'expect-type';
import { DataTypes } from 'sequelize';

const { TINYINT, SMALLINT, MEDIUMINT, BIGINT, INTEGER, JSON, JSONB, CITEXT, MACADDR, TSVECTOR, CIDR, INET } = DataTypes;

// TINYINT
expectTypeOf(TINYINT()).toEqualTypeOf<DataTypes.TinyIntegerDataType>();
expectTypeOf(new TINYINT()).toEqualTypeOf<DataTypes.TinyIntegerDataType>();
expectTypeOf(TINYINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.TinyIntegerDataType>();
expectTypeOf(new TINYINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.TinyIntegerDataType>();

// SMALLINT
expectTypeOf(SMALLINT()).toEqualTypeOf<DataTypes.SmallIntegerDataType>();
expectTypeOf(new SMALLINT()).toEqualTypeOf<DataTypes.SmallIntegerDataType>();
expectTypeOf(SMALLINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.SmallIntegerDataType>();
expectTypeOf(new SMALLINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.SmallIntegerDataType>();

// MEDIUMINT
expectTypeOf(MEDIUMINT()).toEqualTypeOf<DataTypes.MediumIntegerDataType>();
expectTypeOf(new MEDIUMINT()).toEqualTypeOf<DataTypes.MediumIntegerDataType>();
expectTypeOf(MEDIUMINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.MediumIntegerDataType>();
expectTypeOf(new MEDIUMINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.MediumIntegerDataType>();

// BIGINT
expectTypeOf(BIGINT()).toEqualTypeOf<DataTypes.BigIntDataType>();
expectTypeOf(new BIGINT()).toEqualTypeOf<DataTypes.BigIntDataType>();
expectTypeOf(BIGINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.BigIntDataType>();
expectTypeOf(new BIGINT.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.BigIntDataType>();

// INTEGER
expectTypeOf(INTEGER()).toEqualTypeOf<DataTypes.IntegerDataType>();
expectTypeOf(new INTEGER()).toEqualTypeOf<DataTypes.IntegerDataType>();
expectTypeOf(INTEGER.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.IntegerDataType>();
expectTypeOf(new INTEGER.UNSIGNED.ZEROFILL()).toEqualTypeOf<DataTypes.IntegerDataType>();

// JSON
expectTypeOf(new JSON()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(JSON()).toEqualTypeOf<DataTypes.AbstractDataType>();

// JSONB
expectTypeOf(new JSONB()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(JSONB()).toEqualTypeOf<DataTypes.AbstractDataType>();

// CITEXT
expectTypeOf(new CITEXT()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(CITEXT()).toEqualTypeOf<DataTypes.AbstractDataType>();

// MACADDR
expectTypeOf(new MACADDR()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(MACADDR()).toEqualTypeOf<DataTypes.AbstractDataType>();

// TSVECTOR
expectTypeOf(new TSVECTOR()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(TSVECTOR()).toEqualTypeOf<DataTypes.AbstractDataType>();

// CIDR
expectTypeOf(new CIDR()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(CIDR()).toEqualTypeOf<DataTypes.AbstractDataType>();

// INET
expectTypeOf(new INET()).toEqualTypeOf<DataTypes.AbstractDataType>();
expectTypeOf(INET()).toEqualTypeOf<DataTypes.AbstractDataType>();
