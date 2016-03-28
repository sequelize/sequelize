'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , Sequelize = Support.Sequelize;

describe('Sequelize', function() {
  describe('options', function() {
    it('throw error when no dialect is supplied', function() {
      expect(function() {
        new Sequelize('localhost', 'test', 'test');
      }).to.throw(Error);
    });

    it('works when dialect explicitly supplied', function() {
      expect(function() {
        new Sequelize('localhost', 'test', 'test', {
          dialect: 'mysql'
        });
      }).not.to.throw(Error);
    });
  });
});
