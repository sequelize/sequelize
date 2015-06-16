'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Associations'), function() {
  describe('belongsToMany', function () {
    it('works with singular and plural name for self-associations', function () {
      // Models taken from https://github.com/sequelize/sequelize/issues/3796
      var Service = current.define('service', {})
        , Instance = Service.Instance;

      Service.belongsToMany(Service, {through: 'Supplements', as: 'supplements'});
      Service.belongsToMany(Service, {through: 'Supplements', as: {singular: 'supplemented', plural: 'supplemented'}});

      expect(Instance.prototype).to.have.property('getSupplements').which.is.a.function;

      expect(Instance.prototype).to.have.property('addSupplement').which.is.a.function;
      expect(Instance.prototype).to.have.property('addSupplements').which.is.a.function;

      expect(Instance.prototype).to.have.property('getSupplemented').which.is.a.function;
      expect(Instance.prototype).not.to.have.property('getSupplementeds').which.is.a.function;

      expect(Instance.prototype).to.have.property('addSupplemented').which.is.a.function;
      expect(Instance.prototype).not.to.have.property('addSupplementeds').which.is.a.function;
    });
  });
});
