import { expect } from 'chai';
import { Sequelize } from '@sequelize/core';
import { createSequelizeInstance } from '../support';

describe('Sequelize', () => {
  describe('constructor', () => {
    it('should correctly set the host and the port', () => {
      const sequelize = createSequelizeInstance({ host: '127.0.0.1', port: 1234 });
      expect(sequelize.config.port).to.equal(1234);
      expect(sequelize.config.host).to.equal('127.0.0.1');
    });
  });

  describe('version', () => {
    it('should be a string', () => {
      expect(typeof Sequelize.version).to.eq('string');
    });
  });
});
