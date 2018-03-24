'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const current = Support.sequelize;
const sinon = require('sinon');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const Utils = require('../../../lib/utils.js');
const sequelizeErrors = require('../../../lib/errors');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('warnOnInvalidOptions', () => {
    beforeEach(() => {
      this.loggerSpy = sinon.spy(Utils, 'warn');
    });

    afterEach(() => {
      this.loggerSpy.restore();
    });

    it('Warns the user if they use a model attribute without a where clause', () => {
      const User = current.define('User', {firstName: 'string'});
      User.warnOnInvalidOptions({firstName: 12, order: []}, ['firstName']);
      const expectedError = 'Model attributes (firstName) passed into finder method options of model User, but the options.where object is empty. Did you forget to use options.where?';
      expect(this.loggerSpy.calledWith(expectedError)).to.equal(true);
    });

    it('Does not warn the user if they use a model attribute without a where clause that shares its name with a query option', () => {
      const User = current.define('User', {order: 'string'});
      User.warnOnInvalidOptions({order: []}, ['order']);
      expect(this.loggerSpy.called).to.equal(false);
    });

    it('Does not warn the user if they use valid query options', () => {
      const User = current.define('User', {order: 'string'});
      User.warnOnInvalidOptions({where: {order: 1}, order: []});
      expect(this.loggerSpy.called).to.equal(false);
    });
  });

  describe('method findAll', () => {
    const Model = current.define('model', {
      name: DataTypes.STRING
    }, { timestamps: false });

    before(() => {
      this.stub = sinon.stub(current.getQueryInterface(), 'select').callsFake(() => {
        return Model.build({});
      });
      this.warnOnInvalidOptionsStub = sinon.stub(Model, 'warnOnInvalidOptions');
    });

    beforeEach(() => {
      this.stub.reset();
      this.warnOnInvalidOptionsStub.reset();
    });

    after(() => {
      this.stub.restore();
      this.warnOnInvalidOptionsStub.restore();
    });

    describe('handles input validation', () => {
      it('calls warnOnInvalidOptions', () => {
        Model.findAll();
        expect(this.warnOnInvalidOptionsStub.calledOnce).to.equal(true);
      });

      it('Throws an error when the attributes option is formatted incorrectly', () => {
        const errorFunction = Model.findAll.bind(Model, {attributes: 'name'});
        expect(errorFunction).to.throw(sequelizeErrors.QueryError);
      });
    });

    describe('attributes include / exclude', () => {
      it('allows me to include additional attributes', () => {
        return Model.findAll({
          attributes: {
            include: ['foobar']
          }
        }).then(() => {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id',
            'name',
            'foobar'
          ]);
        });
      });

      it('allows me to exclude attributes', () => {
        return Model.findAll({
          attributes: {
            exclude: ['name']
          }
        }).then(() => {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id'
          ]);
        });
      });

      it('include takes precendence over exclude', () => {
        return Model.findAll({
          attributes: {
            exclude: ['name'],
            include: ['name']
          }
        }).then(() => {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id',
            'name'
          ]);
        });
      });

      it('works for models without PK #4607', () => {
        const Model = current.define('model', {}, { timestamps: false });
        const Foo = current.define('foo');
        Model.hasOne(Foo);

        Model.removeAttribute('id');

        return Model.findAll({
          attributes: {
            include: ['name']
          },
          include: [Foo]
        }).then(() => {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'name'
          ]);
        });
      });

    });
  });
});
