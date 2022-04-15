import { Sequelize, Utils } from '@sequelize/core';
import { expect } from 'chai';

const {
  canTreatArrayAsAnd,
  defaultValueSchemable,
  isColString,
  isPrimitive,
  isWhereEmpty,
} = Utils;

describe('utils / check', () => {
  describe('isColString', () => {
    it('should return true if the value starts with $ and ends with $', () => {
      expect(isColString('$col$')).to.equal(true);
    });
    it('should return true if the value contains a separator (e.g. ".")', () => {
      expect(isColString('$table.col$')).to.equal(true);
    });
    it('should return false if the value does not start with $', () => {
      expect(isColString('col$')).to.equal(false);
    });
    it('should return false if the value does not end with $', () => {
      expect(isColString('$col')).to.equal(false);
    });
    it('should return false if no $ is present at all', () => {
      expect(isColString('col')).to.equal(false);
    });
    it('should return false if no $ is present at all but value contains separator', () => {
      expect(isColString('table.col')).to.equal(false);
    });
  });

  describe('isPrimitive', () => {
    it('should return true if the value is a string', () => {
      expect(isPrimitive('string')).to.equal(true);
    });
    it('should return true if the value is a number', () => {
      expect(isPrimitive(1)).to.equal(true);
    });
    it('should return true if the value is a boolean', () => {
      expect(isPrimitive(true)).to.equal(true);
    });
    it('should return false if the value is an object', () => {
      expect(isPrimitive({})).to.equal(false);
    });
    it('should return false if the value is an array', () => {
      expect(isPrimitive([])).to.equal(false);
    });
    it('should return false if the value is a function', () => {
      expect(isPrimitive(() => {})).to.equal(false);
    });
  });

  describe('canTreatArrayAsAnd', () => {
    it('should return true if the array contains an object', () => {
      expect(canTreatArrayAsAnd([{}])).to.equal(true);
    });
    it('should return true if the array contains a Where', () => {
      expect(
        canTreatArrayAsAnd([
          Sequelize.where(Sequelize.col('name'), Sequelize.Op.eq, 'foo'),
        ]),
      ).to.equal(true);
    });
    it('should return false if the array contains anything else', () => {
      expect(canTreatArrayAsAnd([1])).to.equal(false);
    });
  });

  describe('defaultValueSchemable', () => {
    it('should return false if the value is a NOW', () => {
      expect(defaultValueSchemable(Sequelize.DataTypes.NOW)).to.equal(false);
      expect(defaultValueSchemable(Sequelize.DataTypes.NOW())).to.equal(false);
    });
    it('should return false if the value is a UUIDV1', () => {
      expect(defaultValueSchemable(Sequelize.DataTypes.UUIDV1)).to.equal(false);
      expect(defaultValueSchemable(Sequelize.DataTypes.UUIDV1())).to.equal(
        false,
      );
    });
    it('should return false if the value is a UUIDV4', () => {
      expect(defaultValueSchemable(Sequelize.DataTypes.UUIDV4)).to.equal(false);
      expect(defaultValueSchemable(Sequelize.DataTypes.UUIDV4())).to.equal(
        false,
      );
    });
    it('should return true otherwise', () => {
      expect(defaultValueSchemable('hello')).to.equal(true);
      expect(defaultValueSchemable(Sequelize.DataTypes.INTEGER())).to.equal(
        true,
      );
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
