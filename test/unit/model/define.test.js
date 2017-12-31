'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require('../../../lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('define', () => {
    it('should allow custom timestamps with underscored: true', () => {
      const Model = current.define('User', {}, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        timestamps: true,
        underscored: true
      });

      expect(Model.rawAttributes).to.haveOwnProperty('createdAt');
      expect(Model.rawAttributes).to.haveOwnProperty('updatedAt');

      expect(Model._timestampAttributes.createdAt).to.equal('createdAt');
      expect(Model._timestampAttributes.updatedAt).to.equal('updatedAt');

      expect(Model.rawAttributes).not.to.have.property('created_at');
      expect(Model.rawAttributes).not.to.have.property('updated_at');
    });

    it('should create ContextModel success', () => {
      const Model = current.define('UserGroup', {}, {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
      });

      let index = 0;
      class Context {
        constructor() {
          this.value = 'bar';
          this.index = index++;
        }
      }

      const ctx = new Context();
      const ctx2 = new Context();
      const ContextModel1 = Model.contextify(ctx);
      const ContextModel2 = Model.contextify(ctx);
      const ContextModel3 = Model.contextify(ctx2);
      expect(ContextModel1 !== ContextModel2).to.equal(true);
      expect(ContextModel1.ctx === ContextModel2.ctx).to.equal(true);
      expect(ContextModel1.ctx !== ContextModel3.ctx).to.equal(true);

      const model1 = ContextModel1.build();
      expect(model1.ctx).to.be.an('object');
      expect(model1.ctx.value).to.equal('bar');
      expect(model1.ctx.index).to.equal(0);

      const model2 = ContextModel2.build();
      expect(model2.ctx).to.be.an('object');
      const model22 = ContextModel2.build();
      expect(model22.ctx).to.be.an('object');
      const model3 = ContextModel3.build();
      expect(model3.ctx).to.be.an('object');
      expect(model3.ctx.value).to.equal('bar');
      expect(model3.ctx.index).to.equal(1);

      expect(model1.ctx === model2.ctx).to.equal(true);
      expect(model2.ctx === model22.ctx).to.equal(true);
      expect(model2.ctx !== model3.ctx).to.equal(true);
    });

    it('should throw when id is added but not marked as PK', () => {
      expect(() => {
        current.define('foo', {
          id: DataTypes.INTEGER
        });
      }).to.throw("A column called 'id' was added to the attributes of 'foos' but not marked with 'primaryKey: true'");

      expect(() => {
        current.define('bar', {
          id: {
            type: DataTypes.INTEGER
          }
        });
      }).to.throw("A column called 'id' was added to the attributes of 'bars' but not marked with 'primaryKey: true'");
    });
    it('should defend against null or undefined "unique" attributes', () => {
      expect(() => {
        current.define('baz', {
          foo: {
            type: DataTypes.STRING,
            unique: null
          },
          bar: {
            type: DataTypes.STRING,
            unique: undefined
          },
          bop: {
            type: DataTypes.DATE
          }
        });
      }).not.to.throw();
    });
  });
});
