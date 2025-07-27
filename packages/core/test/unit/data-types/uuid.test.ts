import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import util from 'node:util';
import { v1 as generateV1, v4 as generateV4 } from 'uuid';
import { allowDeprecationsInSuite } from '../../support';
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
      sqlite3: 'TEXT',
    });
  });

  describe('validate', () => {
    const allVersions = DataTypes.UUID();
    const v1 = DataTypes.UUID.V1;
    const v4 = DataTypes.UUID.V4;

    it('should throw an error if `value` is invalid', () => {
      expect(() => {
        allVersions.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid uuid`);

      expect(() => {
        allVersions.validate(['foobar']);
      }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuid`);

      const uuidV4 = generateV4();
      expect(() => {
        v1.validate(uuidV4);
      }).to.throw(ValidationErrorItem, util.format('%O is not a valid uuid (version: 1)', uuidV4));

      const uuidV1 = generateV1();
      expect(() => {
        v4.validate(uuidV1);
      }).to.throw(ValidationErrorItem, util.format('%O is not a valid uuid (version: 4)', uuidV1));
    });

    it('should not throw if `value` is an uuid', () => {
      expect(() => allVersions.validate(generateV4())).not.to.throw();
      expect(() => allVersions.validate(generateV1())).not.to.throw();
      expect(() => v1.validate(generateV1())).not.to.throw();
      expect(() => v4.validate(generateV4())).not.to.throw();
    });
  });
});

describe('DataTypes.UUIDV1', () => {
  allowDeprecationsInSuite(['SEQUELIZE0026']);

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

      expect(() => type.validate(generateV1())).not.to.throw();
    });
  });
});

describe('DataTypes.UUIDV4', () => {
  allowDeprecationsInSuite(['SEQUELIZE0026']);

  testDataTypeSql('UUIDV4', DataTypes.UUIDV4, {
    default: new Error('toSQL should not be called on DataTypes.UUIDV4'),
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.UUIDV4();
      const value = generateV1();

      expect(() => {
        type.validate(value);
      }).to.throw(ValidationErrorItem, util.format('%O is not a valid uuidv4', value));

      expect(() => {
        type.validate(['foobar']);
      }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuidv4`);
    });

    it('should not throw if `value` is an uuid', () => {
      const type = DataTypes.UUIDV4();

      expect(() => type.validate(generateV4())).not.to.throw();
    });
  });
});
