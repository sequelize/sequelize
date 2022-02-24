import { Sequelize } from '@sequelize/core';
import { expect } from 'chai';

describe('Sequelize', () => {
  describe('version', () => {
    it('should be a string', () => {
      expect(typeof Sequelize.version).to.eq('string');
    });
  });
});
