'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const current = Support.sequelize;
const sinon = require('sinon');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const Utils = require('../../../lib/utils.js');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe.only('throws warnings on bad input', () => {
    beforeEach(() => {
      this.loggerSpy = sinon.spy(Utils, 'warn');
    });

    afterEach(() => {
      this.loggerSpy.restore();
    });

    it('Warns the user if they use unrecognized options', () => {
      const User = current.define('User');
      User.warnOnInvalidOptions({fakeOption1 : 12, fakeOption2 : 'hi', order: []});
      const expectedError = 'Invalid selections (fakeOption1, fakeOption2) passed into finder method options. These selections will be ignored.';
      expect(this.loggerSpy.calledWith(expectedError)).to.be.true;
    });

    it('Warns the user if they a model attribute without a where clause', () => {
      const User = current.define('User', {name: 'string'});
      User.warnOnInvalidOptions({name : 12, order: []}, ['name']);
      const expectedError = 'Model attributes (name) passed into finder method options, but the options.where object is empty. Did you forget to use options.where?';
      expect(this.loggerSpy.calledWith(expectedError)).to.be.true;
    });

    it('Does not warn the user if they use a model attribute without a where clause that shares its name with a query option', () => {
      const User = current.define('User', {order: 'string'});
      User.warnOnInvalidOptions({order: []});
      expect(this.loggerSpy.called).to.be.false;
    });

    it('Does not warn the user if they use valid query options', () => {
      const User = current.define('User', {order: 'string'});
      User.warnOnInvalidOptions({where: {order: 1}, order: []});
      expect(this.loggerSpy.called).to.be.false;
    });
  });

  describe('method findAll', function () {
    const Model = current.define('model', {
      name: DataTypes.STRING
    }, { timestamps: false });

    before(function () {
      this.stub = sinon.stub(current.getQueryInterface(), 'select', function () {
        return Model.build({});
      });
    });

    beforeEach(function () {
      this.stub.reset();
    });

    after(function () {
      this.stub.restore();
    });

    describe('attributes include / exclude', function () {
      it('allows me to include additional attributes', function () {
        return Model.findAll({
          attributes: {
            include: ['foobar']
          }
        }).bind(this).then(function () {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id',
            'name',
            'foobar'
          ]);
        });
      });

      it('allows me to exclude attributes', function () {
        return Model.findAll({
          attributes: {
            exclude: ['name']
          }
        }).bind(this).then(function () {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id'
          ]);
        });
      });

      it('include takes precendence over exclude', function () {
        return Model.findAll({
          attributes: {
            exclude: ['name'],
            include: ['name']
          }
        }).bind(this).then(function () {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id',
            'name'
          ]);
        });
      });

      it('works for models without PK #4607', function () {
        const Model = current.define('model', {}, { timestamps: false });
        const Foo = current.define('foo');
        Model.hasOne(Foo);

        Model.removeAttribute('id');

        return Model.findAll({
          attributes: {
            include: ['name']
          },
          include: [Foo]
        }).bind(this).then(function () {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'name'
          ]);
        });
      });

    });
  });
});
