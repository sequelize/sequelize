const { expect } = require('chai');
const { isColString } = require('sequelize/lib/utils/check');

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
  });
});
