import { expect } from 'chai';
import { ValidationErrorItem, DataTypes } from '@sequelize/core';
import { sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;

describe('DataTypes.ARRAY', () => {
  const unsupportedError = new Error(`${dialect.name} does not support the ARRAY data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

  testDataTypeSql('ARRAY(VARCHAR)', DataTypes.ARRAY(DataTypes.STRING), {
    default: unsupportedError,
    'postgres cockroachdb': 'VARCHAR(255)[]',
  });

  testDataTypeSql('ARRAY(VARCHAR(100))', DataTypes.ARRAY(DataTypes.STRING(100)), {
    default: unsupportedError,
    'postgres cockroachdb': 'VARCHAR(100)[]',
  });

  testDataTypeSql('ARRAY(INTEGER)', DataTypes.ARRAY(DataTypes.INTEGER), {
    default: unsupportedError,
    'postgres cockroachdb': 'INTEGER[]',
  });

  testDataTypeSql('ARRAY(HSTORE)', DataTypes.ARRAY(DataTypes.HSTORE), {
    default: unsupportedError,
    'postgres cockroachdb': 'HSTORE[]',
  });

  testDataTypeSql('ARRAY(ARRAY(VARCHAR(255)))', DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.STRING)), {
    default: unsupportedError,
    'postgres cockroachdb': 'VARCHAR(255)[][]',
  });

  testDataTypeSql('ARRAY(TEXT)', DataTypes.ARRAY(DataTypes.TEXT), {
    default: unsupportedError,
    'postgres cockroachdb': 'TEXT[]',
  });

  testDataTypeSql('ARRAY(DATE)', DataTypes.ARRAY(DataTypes.DATE), {
    default: unsupportedError,
    postgres: 'TIMESTAMP WITH TIME ZONE[]',
  });

  testDataTypeSql('ARRAY(BOOLEAN)', DataTypes.ARRAY(DataTypes.BOOLEAN), {
    default: unsupportedError,
    'postgres cockroachdb': 'BOOLEAN[]',
  });

  testDataTypeSql('ARRAY(DECIMAL)', DataTypes.ARRAY(DataTypes.DECIMAL), {
    default: unsupportedError,
    'postgres cockroachdb': 'DECIMAL[]',
  });

  testDataTypeSql('ARRAY(DECIMAL(6, 4))', DataTypes.ARRAY(DataTypes.DECIMAL(6, 4)), {
    default: unsupportedError,
    'postgres cockroachdb': 'DECIMAL(6, 4)[]',
  });

  testDataTypeSql('ARRAY(DOUBLE)', DataTypes.ARRAY(DataTypes.DOUBLE), {
    default: unsupportedError,
    'postgres cockroachdb': 'DOUBLE PRECISION[]',
  });

  testDataTypeSql('ARRAY(REAL))', DataTypes.ARRAY(DataTypes.REAL), {
    default: unsupportedError,
    'postgres cockroachdb': 'REAL[]',
  });

  testDataTypeSql('ARRAY(JSON)', DataTypes.ARRAY(DataTypes.JSON), {
    default: unsupportedError,
    'postgres cockroachdb': 'JSON[]',
  });

  testDataTypeSql('ARRAY(JSONB)', DataTypes.ARRAY(DataTypes.JSONB), {
    default: unsupportedError,
    'postgres cockroachdb': 'JSONB[]',
  });

  testDataTypeSql('ARRAY(CITEXT)', DataTypes.ARRAY(DataTypes.CITEXT), {
    default: unsupportedError,
    'postgres cockroachdb': 'CITEXT[]',
  });

  it('raises an error if no values are defined', () => {
    expect(() => {
      sequelize.define('omnomnom', {
        bla: { type: DataTypes.ARRAY },
      });
    }).to.throwWithCause(Error, 'ARRAY is missing type definition for its values.');
  });

  describe('validate', () => {
    if (!dialect.supports.dataTypes.ARRAY) {
      return;
    }

    describe('validate', () => {
      it('should throw an error if `value` is invalid', () => {
        const type = DataTypes.ARRAY(DataTypes.INTEGER);

        expect(() => {
          type.validate('foobar');
        }).to.throw(ValidationErrorItem, `'foobar' is not a valid array`);
      });

      it('should not throw if `value` is an array', () => {
        const type = DataTypes.ARRAY(DataTypes.STRING);

        expect(() => type.validate(['foo', 'bar'])).not.to.throw();
      });
    });
  });
});
