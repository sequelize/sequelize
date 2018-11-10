'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require(__dirname + '/../support'),
  current   = Support.sequelize,
  _ = require('lodash'),
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('removeAttribute', () => {
    it('should support removing the primary key', () => {
      const Model = current.define('m', {
        name: DataTypes.STRING
      });

      expect(Model.primaryKeyAttribute).not.to.be.undefined;
      expect(_.size(Model.primaryKeys)).to.equal(1);

      Model.removeAttribute('id');

      expect(Model.primaryKeyAttribute).to.be.undefined;
      expect(_.size(Model.primaryKeys)).to.equal(0);
    });

    it('should not add undefined attribute after removing primary key', () => {
      const Model = current.define('m', {
        name: DataTypes.STRING
      });

      Model.removeAttribute('id');

      const instance = Model.build();
      expect(instance.dataValues).not.to.include.keys('undefined');
    });
  });
});
