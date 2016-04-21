'use strict';

/* jshint -W030 */
var chai = require('chai')
, expect = chai.expect
, Support = require(__dirname + '/../support')
, current = Support.sequelize
, sinon = require('sinon')
, DataTypes = require(__dirname + '/../../../lib/data-types')
, _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('method findAndCountAll', function () {
    var Model = current.define('model', {
      name: DataTypes.STRING
    }, { timestamps: false });

    var Model2 = current.define('model2', {
      name: DataTypes.STRING
    }, { timestamps: false });

    Model.hasMany(Model2);
    Model2.belongsTo(Model);

    before(function () {
      this.stub = sinon.stub(current.getQueryInterface(), 'select', function () {
        return Model.build({});
      });
      this.stubRaw = sinon.stub(current.getQueryInterface(), 'rawSelect', function () {
        return Model.build({});
      });
    });

    beforeEach(function () {
      this.stub.reset();
      this.stubRaw.reset();
    });

    after(function () {
      this.stub.restore();
      this.stubRaw.restore();
    });

    it('properly clones options values', function() {
      var options = {
        includes: [
          { model: 'model2', where: {
            name: 'hello'
          }}
        ]
      };
      var optionsClones = _.cloneDeep(options);
      return Model.findAndCountAll(options).bind(this).then(function () {
        expect(options).to.deep.equal(optionsClones);
      });
    });

  });
});
