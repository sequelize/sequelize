import util from 'node:util';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { v1 as uuidV1, v4 as uuidV4 } from 'uuid';
import { testDataTypeSql } from './_utils';

describe('DataTypes.UUID', () => {
  describe('toSql', () => {
    testDataTypeSql('UUID', DataTypes.UUID, {
      postgres: 'UUID',
      ibmi: 'CHAR(36)',
      db2: 'CHAR(36) FOR BIT DATA',
      mssql: 'UNIQUEIDENTIFIER',
      'mariadb mysql': 'CHAR(36) BINARY',
      snowflake: 'VARCHAR(36)',
      sqlite: 'TEXT',
    });
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.UUID();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid uuid`);

      expect(() => {
        type.validate(['foobar']);
      }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuid`);
    });

    it('should not throw if `value` is an uuid', () => {
      const type = DataTypes.UUID();

      expect(() => type.validate(uuidV4())).not.to.throw();
    });
  });
});

describe('DataTypes.UUIDV1', () => {
  testDataTypeSql('UUIDV1', DataTypes.UUIDV1, {
    default: new Error('toSQL should not be called on DataTypes.UUIDV1'),
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.UUIDV1();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid uuid`);

      expect(() => {
        type.validate(['foobar']);
      }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuidv1`);
    });

    it('should not throw if `value` is an uuid', () => {
      const type = DataTypes.UUIDV1();

      expect(() => type.validate(uuidV1())).not.to.throw();
    });
  });
});

describe('DataTypes.UUIDV4', () => {
  testDataTypeSql('UUIDV4', DataTypes.UUIDV4, {
    default: new Error('toSQL should not be called on DataTypes.UUIDV4'),
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.UUIDV4();
      const value = uuidV1();

      expect(() => {
        type.validate(value);
      }).to.throw(ValidationErrorItem, util.format('%O is not a valid uuidv4', value));

      expect(() => {
        type.validate(['foobar']);
      }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuidv4`);
    });

    it('should not throw if `value` is an uuid', () => {
      const type = DataTypes.UUIDV4();

      expect(() => type.validate(uuidV4())).not.to.throw();
    });
  });
});
