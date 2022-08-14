'use strict';

const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const chai = require('chai');

const expect = chai.expect;
const sinon = require('sinon');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('paranoid', () => {
    before(function () {
      this.clock = sinon.useFakeTimers();
    });

    after(function () {
      this.clock.restore();
    });

    it('should be able to soft delete with timestamps', async function () {
      const Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id',
        },
        name: {
          type: DataTypes.STRING,
        },
      }, {
        paranoid: true,
        timestamps: true,
      });

      await Account.sync({ force: true });
      await Account.create({ ownerId: 12 });
      const count2 = await Account.count();
      expect(count2).to.be.equal(1);
      const result = await Account.destroy({ where: { ownerId: 12 } });
      expect(result).to.be.a('number');
      const count1 = await Account.count();
      expect(count1).to.be.equal(0);
      const count0 = await Account.count({ paranoid: false });
      expect(count0).to.be.equal(1);
      await Account.restore({ where: { ownerId: 12 } });
      const count = await Account.count();
      expect(count).to.be.equal(1);
    });

    it('should be able to soft delete without timestamps', async function () {
      const Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id',
        },
        name: {
          type: DataTypes.STRING,
        },
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'deleted_at',
        },
      }, {
        paranoid: true,
        timestamps: true,
        deletedAt: 'deletedAt',
        createdAt: false,
        updatedAt: false,
      });

      await Account.sync({ force: true });
      await Account.create({ ownerId: 12 });
      const count2 = await Account.count();
      expect(count2).to.be.equal(1);
      await Account.destroy({ where: { ownerId: 12 } });
      const count1 = await Account.count();
      expect(count1).to.be.equal(0);
      const count0 = await Account.count({ paranoid: false });
      expect(count0).to.be.equal(1);
      await Account.restore({ where: { ownerId: 12 } });
      const count = await Account.count();
      expect(count).to.be.equal(1);
    });

    if (current.dialect.supports.returnValues.returning) {
      it('should be able to return soft deleted records with timestamps when `options.returning` is set to true', async function () {
        const Account = this.sequelize.define('Account', {
          ownerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'owner_id',
          },
          name: {
            type: DataTypes.STRING,
          },
        }, {
          paranoid: true,
          timestamps: true,
        });

        await Account.sync({ force: true });
        await Account.create({ ownerId: 12 });
        const count2 = await Account.count();
        expect(count2).to.be.equal(1);
        let [affectedRowsCount, affectedRows] = await Account.destroy({ where: { ownerId: 12 }, returning: true });
        expect(affectedRowsCount).to.be.a('number').to.equal(1);
        expect(affectedRows).to.have.length(1);
        const count1 = await Account.count();
        expect(count1).to.be.equal(0);
        const count0 = await Account.count({ paranoid: false });
        expect(count0).to.be.equal(1);
        await Account.restore({ where: { ownerId: 12 } });
        const count = await Account.count();
        expect(count).to.be.equal(1);
        [affectedRowsCount, affectedRows] = await Account.destroy({ where: { ownerId: 12 }, returning: ['name'] });
        expect(affectedRowsCount).to.be.a('number').to.equal(1);
        JSON.parse(JSON.stringify(affectedRows)).forEach(accountObj => {
          expect(accountObj).to.have.all.keys('name');
        });
      });

      it('should not be able to return soft deleted records with timestamps when `options.returning` is set to false', async function () {
        const Account = this.sequelize.define('Account', {
          ownerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'owner_id',
          },
          name: {
            type: DataTypes.STRING,
          },
        }, {
          paranoid: true,
          timestamps: true,
        });

        await Account.sync({ force: true });
        await Account.create({ ownerId: 12 });
        const count2 = await Account.count();
        expect(count2).to.be.equal(1);
        const affectedRowsCount = await Account.destroy({ where: { ownerId: 12 }, returning: false });
        expect(affectedRowsCount).to.be.a('number');
        const count1 = await Account.count();
        expect(count1).to.be.equal(0);
        const count0 = await Account.count({ paranoid: false });
        expect(count0).to.be.equal(1);
        await Account.restore({ where: { ownerId: 12 } });
        const count = await Account.count();
        expect(count).to.be.equal(1);
      });
    }

    if (current.dialect.supports.JSON) {
      describe('JSON', () => {
        before(function () {
          this.Model = this.sequelize.define('Model', {
            name: {
              type: DataTypes.STRING,
            },
            data: {
              type: DataTypes.JSON,
            },
            deletedAt: {
              type: DataTypes.DATE,
              allowNull: true,
              field: 'deleted_at',
            },
          }, {
            paranoid: true,
            timestamps: true,
            deletedAt: 'deletedAt',
          });
        });

        beforeEach(async function () {
          await this.Model.sync({ force: true });
        });

        it('should soft delete with JSON condition', async function () {
          await this.Model.bulkCreate([{
            name: 'One',
            data: {
              field: {
                deep: true,
              },
            },
          }, {
            name: 'Two',
            data: {
              field: {
                deep: false,
              },
            },
          }]);

          await this.Model.destroy({
            where: {
              data: {
                field: {
                  deep: true,
                },
              },
            },
          });

          const records = await this.Model.findAll();
          expect(records.length).to.equal(1);
          expect(records[0].get('name')).to.equal('Two');
        });
      });
    }
  });
});
