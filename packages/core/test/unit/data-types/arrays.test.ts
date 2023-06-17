import { expect } from 'chai';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const { dialect, queryGenerator } = sequelize;

describe('DataTypes.ARRAY', () => {
  const unsupportedError = new Error(`${dialect.name} does not support the ARRAY data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

  testDataTypeSql('ARRAY(VARCHAR)', DataTypes.ARRAY(DataTypes.STRING), {
    default: unsupportedError,
    postgres: 'VARCHAR(255)[]',
  });

  testDataTypeSql('ARRAY(VARCHAR(100))', DataTypes.ARRAY(DataTypes.STRING(100)), {
    default: unsupportedError,
    postgres: 'VARCHAR(100)[]',
  });

  testDataTypeSql('ARRAY(INTEGER)', DataTypes.ARRAY(DataTypes.INTEGER), {
    default: unsupportedError,
    postgres: 'INTEGER[]',
  });

  testDataTypeSql('ARRAY(HSTORE)', DataTypes.ARRAY(DataTypes.HSTORE), {
    default: unsupportedError,
    postgres: 'HSTORE[]',
  });

  testDataTypeSql('ARRAY(ARRAY(VARCHAR(255)))', DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.STRING)), {
    default: unsupportedError,
    postgres: 'VARCHAR(255)[][]',
  });

  testDataTypeSql('ARRAY(TEXT)', DataTypes.ARRAY(DataTypes.TEXT), {
    default: unsupportedError,
    postgres: 'TEXT[]',
  });

  testDataTypeSql('ARRAY(DATE)', DataTypes.ARRAY(DataTypes.DATE), {
    default: unsupportedError,
    postgres: 'TIMESTAMP WITH TIME ZONE[]',
  });

  testDataTypeSql('ARRAY(BOOLEAN)', DataTypes.ARRAY(DataTypes.BOOLEAN), {
    default: unsupportedError,
    postgres: 'BOOLEAN[]',
  });

  testDataTypeSql('ARRAY(DECIMAL)', DataTypes.ARRAY(DataTypes.DECIMAL), {
    default: unsupportedError,
    postgres: 'DECIMAL[]',
  });

  testDataTypeSql('ARRAY(DECIMAL(6, 4))', DataTypes.ARRAY(DataTypes.DECIMAL(6, 4)), {
    default: unsupportedError,
    postgres: 'DECIMAL(6, 4)[]',
  });

  testDataTypeSql('ARRAY(DOUBLE)', DataTypes.ARRAY(DataTypes.DOUBLE), {
    default: unsupportedError,
    postgres: 'DOUBLE PRECISION[]',
  });

  testDataTypeSql('ARRAY(REAL))', DataTypes.ARRAY(DataTypes.REAL), {
    default: unsupportedError,
    postgres: 'REAL[]',
  });

  testDataTypeSql('ARRAY(JSON)', DataTypes.ARRAY(DataTypes.JSON), {
    default: unsupportedError,
    postgres: 'JSON[]',
  });

  testDataTypeSql('ARRAY(JSONB)', DataTypes.ARRAY(DataTypes.JSONB), {
    default: unsupportedError,
    postgres: 'JSONB[]',
  });

  testDataTypeSql('ARRAY(CITEXT)', DataTypes.ARRAY(DataTypes.CITEXT), {
    default: unsupportedError,
    postgres: 'CITEXT[]',
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

  describe('escape', () => {
    if (!dialect.supports.dataTypes.ARRAY) {
      return;
    }

    it('escapes array of JSON', () => {
      expectsql(queryGenerator.escape([
        { some: 'nested', more: { nested: true }, answer: 42 },
        43,
        'joe',
      ], { type: DataTypes.ARRAY(DataTypes.JSON) }), {
        postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSON[]',
      });
    });

    if (dialect.supports.dataTypes.JSONB) {
      it('escapes array of JSONB', () => {
        expectsql(
          queryGenerator.escape(
            [
              { some: 'nested', more: { nested: true }, answer: 42 },
              43,
              'joe',
            ],
            { type: DataTypes.ARRAY(DataTypes.JSONB) },
          ),
          {
            postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSONB[]',
          },
        );
      });
    }
  });
});
