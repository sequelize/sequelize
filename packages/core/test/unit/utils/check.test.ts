import { DataTypes } from '@sequelize/core';
import {
  defaultValueSchemable,
  isWhereEmpty,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { expect } from 'chai';
import { allowDeprecationsInSuite, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('utils / check', () => {
  describe('defaultValueSchemable', () => {
    allowDeprecationsInSuite(['SEQUELIZE0026']);

    it('should return false if the value is a NOW', () => {
      expect(defaultValueSchemable(DataTypes.NOW, dialect)).to.equal(false);
      expect(defaultValueSchemable(DataTypes.NOW(), dialect)).to.equal(false);
    });
    it('should return false if the value is a UUIDV1', () => {
      expect(defaultValueSchemable(DataTypes.UUIDV1, dialect)).to.equal(false);
      expect(defaultValueSchemable(DataTypes.UUIDV1(), dialect)).to.equal(false);
    });
    it('should return false if the value is a UUIDV4', () => {
      expect(defaultValueSchemable(DataTypes.UUIDV4, dialect)).to.equal(false);
      expect(defaultValueSchemable(DataTypes.UUIDV4(), dialect)).to.equal(false);
    });
    it('should return true otherwise', () => {
      expect(defaultValueSchemable('hello', dialect)).to.equal(true);
      expect(defaultValueSchemable(DataTypes.INTEGER(), dialect)).to.equal(true);
    });
  });

  describe('isWhereEmpty', () => {
    it('should return true if the where is empty', () => {
      expect(isWhereEmpty({})).to.equal(true);
    });
    it('should return false if the where is not empty', () => {
      expect(isWhereEmpty({ a: 1 })).to.equal(false);
    });
    it('should return false even if value is empty', () => {
      expect(isWhereEmpty({ a: undefined })).to.equal(false);
    });
  });
});
