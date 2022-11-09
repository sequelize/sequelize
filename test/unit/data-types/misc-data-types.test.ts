import type { DataTypeInstance } from '@sequelize/core';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize, getTestDialect } from '../../support';
import { testDataTypeSql } from './_utils';

const dialectName = getTestDialect();

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
