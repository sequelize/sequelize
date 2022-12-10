import assert from 'node:assert';
import { expect } from 'chai';
import type { DataTypeInstance } from '@sequelize/core';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('DataTypes.ENUM', () => {
  it('produces an enum', () => {
    const User = sequelize.define('User', {
      anEnum: DataTypes.ENUM('value 1', 'value 2'),
    });

    const enumType = User.rawAttributes.anEnum.type;
    assert(typeof enumType !== 'string');

    expectsql(enumType.toSql({ dialect }), {
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

  it('accepts readonly arrays for `options.values`', () => {
    const values = ['A', 'B', 'C', 'D', 'E'] as const;
    const nonConstValues = ['A', 'B', 'C', 'D', 'E'];
    const type = DataTypes.ENUM({ values });

    expect(type.options.values).to.deep.equal(values);
    expect(type.options.values).not.to.equal(nonConstValues);
  });

  it('accepts mutable arrays for `options.values`', () => {
    const values = ['A', 'B', 'C', 'D', 'E'];
    const constValues = ['A', 'B', 'C', 'D', 'E'] as const;
    const type = DataTypes.ENUM({ values });

    expect(type.options.values).to.deep.equal(values);
    expect(type.options.values).not.to.equal(constValues);
  });

  it('accepts readonly arrays for `values`', () => {
    const values = ['A', 'B', 'C', 'D', 'E'] as const;
    const nonConstValues = ['A', 'B', 'C', 'D', 'E'];
    const type = DataTypes.ENUM({ values });

    expect(type.options.values).to.deep.equal(values);
    expect(type.options.values).not.to.equal(nonConstValues);
  });

  it('accepts mutable arrays for `values`', () => {
    const values = ['A', 'B', 'C', 'D', 'E'];
    const constValues = ['A', 'B', 'C', 'D', 'E'] as const;
    const type = DataTypes.ENUM({ values });

    expect(type.options.values).to.deep.equal(values);
    expect(type.options.values).not.to.equal(constValues);
  });
});
