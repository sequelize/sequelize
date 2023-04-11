import assert from 'node:assert';
import { expect } from 'chai';
import type { DataTypeInstance } from '@sequelize/core';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const { queryGenerator, dialect } = sequelize;
const dialectName = dialect.name;

describe('DataTypes.BOOLEAN', () => {
  testDataTypeSql('BOOLEAN', DataTypes.BOOLEAN, {
    default: 'BOOLEAN',
    ibmi: 'SMALLINT',
    mssql: 'BIT',
    mariadb: 'TINYINT(1)',
    mysql: 'TINYINT(1)',
    sqlite: 'INTEGER',
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type: DataTypeInstance = DataTypes.BOOLEAN();

      expect(() => {
        type.validate(12_345);
      }).to.throw(ValidationErrorItem, '12345 is not a valid boolean');
    });

    it('should not throw if `value` is a boolean', () => {
      const type = DataTypes.BOOLEAN();

      expect(() => type.validate(true)).not.to.throw();
      expect(() => type.validate(false)).not.to.throw();
      expect(() => type.validate('1')).to.throw();
      expect(() => type.validate('0')).to.throw();
      expect(() => type.validate('true')).to.throw();
      expect(() => type.validate('false')).to.throw();
    });
  });
});

describe('DataTypes.ENUM', () => {
  it('produces an enum', () => {
    const User = sequelize.define('User', {
      anEnum: DataTypes.ENUM('value 1', 'value 2'),
    });

    const enumType = User.getAttributes().anEnum.type;
    assert(typeof enumType !== 'string');

    expectsql(enumType.toSql(), {
      postgres: '"public"."enum_Users_anEnum"',
      'mysql mariadb': `ENUM('value 1', 'value 2')`,
      // SQL Server does not support enums, we use text + a check constraint instead
      mssql: `NVARCHAR(255)`,
      sqlite: 'TEXT',
      'db2 ibmi snowflake': 'VARCHAR(255)',
    });
  });

  it('raises an error if the legacy "values" property is specified', () => {
    expect(() => {
      sequelize.define('omnomnom', {
        bla: {
          type: DataTypes.ENUM('a', 'b'),
          // @ts-expect-error -- property should not be specified but we're testing that it throws
          values: ['a', 'b'],
        },
      });
    }).to.throwWithCause(Error, 'The "values" property has been removed from column definitions.');
  });

  it('raises an error if no values are defined', () => {
    expect(() => {
      sequelize.define('omnomnom', {
        bla: { type: DataTypes.ENUM },
      });
    }).to.throwWithCause(Error, 'DataTypes.ENUM cannot be used without specifying its possible enum values.');
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type: DataTypeInstance = DataTypes.ENUM('foo');

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid choice for enum [ 'foo' ]`);
    });

    it('should not throw if `value` is a valid choice', () => {
      const type = DataTypes.ENUM('foobar', 'foobiz');

      expect(() => type.validate('foobar')).not.to.throw();
      expect(() => type.validate('foobiz')).not.to.throw();
    });
  });
});

describe('DataTypes.RANGE', () => {
  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.RANGE(DataTypes.INTEGER);

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, 'A range must either be an array with two elements, or an empty array for the empty range.');
    });

    it('should throw an error if `value` is not an array with two elements', () => {
      const type = DataTypes.RANGE(DataTypes.INTEGER);

      expect(() => {
        type.validate([1]);
      }).to.throw(ValidationErrorItem, 'A range must either be an array with two elements, or an empty array for the empty range.');
    });

    it('should not throw if `value` is a range', () => {
      const type = DataTypes.RANGE(DataTypes.INTEGER);

      expect(() => type.validate([1, 2])).not.to.throw();
    });
  });
});

describe('DataTypes.JSON', () => {
  testDataTypeSql('JSON', DataTypes.JSON, {
    default: new Error(`${dialectName} does not support the JSON data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),

    // All dialects must support DataTypes.JSON. If your dialect does not have a native JSON type, use an as-big-as-possible text type instead.
    'mariadb mysql postgres': 'JSON',
    // SQL server supports JSON functions, but it is stored as a string with a ISJSON constraint.
    mssql: 'NVARCHAR(MAX)',
    sqlite: 'TEXT',
  });

  describe('escape', () => {
    if (!dialect.supports.dataTypes.JSON) {
      return;
    }

    it('escapes plain string', () => {
      expectsql(queryGenerator.escape('string', { type: new DataTypes.JSON() }), {
        default: `'"string"'`,
        mysql: `CAST('"string"' AS JSON)`,
        mssql: `N'"string"'`,
      });
    });

    it('escapes plain int', () => {
      expectsql(queryGenerator.escape(0, { type: new DataTypes.JSON() }), {
        default: `'0'`,
        mysql: `CAST('0' AS JSON)`,
        mssql: `N'0'`,
      });
      expectsql(queryGenerator.escape(123, { type: new DataTypes.JSON() }), {
        default: `'123'`,
        mysql: `CAST('123' AS JSON)`,
        mssql: `N'123'`,
      });
    });

    it('escapes boolean', () => {
      expectsql(queryGenerator.escape(true, { type: new DataTypes.JSON() }), {
        default: `'true'`,
        mysql: `CAST('true' AS JSON)`,
        mssql: `N'true'`,
      });
      expectsql(queryGenerator.escape(false, { type: new DataTypes.JSON() }), {
        default: `'false'`,
        mysql: `CAST('false' AS JSON)`,
        mssql: `N'false'`,
      });
    });

    it('escapes NULL', () => {
      expectsql(queryGenerator.escape(null, { type: new DataTypes.JSON() }), {
        default: `'null'`,
        mysql: `CAST('null' AS JSON)`,
        mssql: `N'null'`,
      });
    });

    it('nested object', () => {
      expectsql(queryGenerator.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: new DataTypes.JSON() }), {
        default: `'{"some":"nested","more":{"nested":true},"answer":42}'`,
        mysql: `CAST('{"some":"nested","more":{"nested":true},"answer":42}' AS JSON)`,
        mssql: `N'{"some":"nested","more":{"nested":true},"answer":42}'`,
      });
    });
  });
});

describe('DataTypes.JSONB', () => {
  testDataTypeSql('JSONB', DataTypes.JSONB, {
    default: new Error(`${dialectName} does not support the JSONB data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
    postgres: 'JSONB',
  });
});

describe('DataTypes.HSTORE', () => {
  describe('toSql', () => {
    testDataTypeSql('HSTORE', DataTypes.HSTORE, {
      default: new Error(`${dialectName} does not support the HSTORE data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
      postgres: 'HSTORE',
    });
  });

  describe('validate', () => {
    if (!sequelize.dialect.supports.dataTypes.HSTORE) {
      return;
    }

    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.HSTORE();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid hstore`);
    });

    it('should not throw if `value` is an hstore', () => {
      const type = DataTypes.HSTORE();

      expect(() => type.validate({ foo: 'bar' })).not.to.throw();
    });
  });
});
