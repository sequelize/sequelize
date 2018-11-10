'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  current   = Support.sequelize,
  Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('increment', () => {
    describe('options tests', () => {
      const Model = current.define('User', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true
        },
        count: Sequelize.BIGINT
      });

      it('should reject if options are missing', () => {
        return expect(() => Model.increment(['id', 'count']))
          .to.throw('Missing where attribute in the options parameter');
      });

      it('should reject if options.where are missing', () => {
        return expect(() => Model.increment(['id', 'count'], { by: 10}))
          .to.throw('Missing where attribute in the options parameter');
      });
    });
  });
});
