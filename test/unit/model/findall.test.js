'use strict';

/* jshint -W030 */
let chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , sinon = require('sinon')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('method findAll', function() {
    const Model = current.define('model', {
      name: DataTypes.STRING
    }, { timestamps: false });

    before(function() {
      this.stub = sinon.stub(current.getQueryInterface(), 'select', function() {
        return Model.build({});
      });
    });

    beforeEach(function() {
      this.stub.reset();
    });

    after(function() {
      this.stub.restore();
    });

    describe('attributes include / exclude', function() {
      it('allows me to include additional attributes', function() {
        return Model.findAll({
          attributes: {
            include: ['foobar']
          }
        }).bind(this).then(function() {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id',
            'name',
            'foobar'
          ]);
        });
      });

      it('allows me to exclude attributes', function() {
        return Model.findAll({
          attributes: {
            exclude: ['name']
          }
        }).bind(this).then(function() {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id'
          ]);
        });
      });

      it('include takes precendence over exclude', function() {
        return Model.findAll({
          attributes: {
            exclude: ['name'],
            include: ['name']
          }
        }).bind(this).then(function() {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'id',
            'name'
          ]);
        });
      });

      it('works for models without PK #4607', function() {
        const Model = current.define('model', {}, { timestamps: false });
        const Foo = current.define('foo');
        Model.hasOne(Foo);

        Model.removeAttribute('id');

        return Model.findAll({
          attributes: {
            include: ['name']
          },
          include: [Foo]
        }).bind(this).then(function() {
          expect(this.stub.getCall(0).args[2].attributes).to.deep.equal([
            'name'
          ]);
        });
      });

    });
  });
});
