'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method update', () => {
    before(function() {
      this.User = current.define('User', {
        name: DataTypes.STRING,
        secretValue: DataTypes.INTEGER
      });
    });

    beforeEach(function() {
      this.stubUpdate = sinon.stub(current.getQueryInterface(), 'bulkUpdate').resolves([]);
      this.updates = { name: 'Batman', secretValue: '7' };
      this.cloneUpdates = { ...this.updates };
    });

    afterEach(function() {
      this.stubUpdate.restore();
    });

    afterEach(function() {
      delete this.updates;
      delete this.cloneUpdates;
    });

    describe('properly clones input values', () => {
      it('with default options', async function() {
        await this.User.update(this.updates, { where: { secretValue: '1' } });
        expect(this.updates).to.be.deep.eql(this.cloneUpdates);
      });

      it('when using fields option', async function() {
        await this.User.update(this.updates, { where: { secretValue: '1' }, fields: ['name'] });
        expect(this.updates).to.be.deep.eql(this.cloneUpdates);
      });
    });

    it('can detect complexe objects', async function() {
      const Where = function() { this.secretValue = '1'; };

      await expect(this.User.update(this.updates, { where: new Where() })).to.be.rejected;
    });
  });

  describe('Update with multiple models to the same table', () => {
    before(function() {
      this.Model1 = current.define('Model1', {
        value: DataTypes.INTEGER,
        name: DataTypes.STRING,
        isModel2: DataTypes.BOOLEAN,
        model1ExclusiveData: DataTypes.STRING
      }, {
        tableName: 'model_table'
      });

      this.Model2 = current.define('Model2', {
        value: DataTypes.INTEGER,
        name: DataTypes.STRING
      }, {
        tableName: 'model_table'
      });
    });

    beforeEach(function() {
      this.stubQuery = sinon.stub(current, 'query').resolves([]);
    });

    afterEach(function() {
      this.stubQuery.restore();
    });

    it('updates model1 using model1 model', async function()  {
      await this.Model1.update({
        name: 'other name',
        model1ExclusiveData: 'only I can update this field'
      }, {
        where: { value: 1 }
      });
      expect(this.stubQuery.lastCall.lastArg.model).to.eq(this.Model1);
    });

    it('updates model2 using model2 model', async function()  {
      await this.Model2.update({
        name: 'other name'
      }, {
        where: { value: 2 }
      });
      expect(this.stubQuery.lastCall.lastArg.model).to.eq(this.Model2);
    });
  });
});
