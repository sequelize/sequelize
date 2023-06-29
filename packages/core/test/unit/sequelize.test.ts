import { expect } from 'chai';
import { Sequelize } from '@sequelize/core';

describe('Sequelize', () => {
  describe('version', () => {
    it('should be a string', () => {
      expect(typeof Sequelize.version).to.eq('string');
    });
  });
});
