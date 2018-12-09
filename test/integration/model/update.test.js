'use strict';

const Support = require('../support');
const DataTypes = require('../../../lib/data-types');
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const current = Support.sequelize;
const _ = require('lodash');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('update', () => {
    beforeEach(function() {
      this.Account = this.sequelize.define('Account', {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id'
        },
        name: {
          type: DataTypes.STRING
        }
      });
      return this.Account.sync({ force: true });
    });

    it('should only update the passed fields', function() {
      return this.Account
        .create({ ownerId: 2 })
        .then(account => this.Account.update({
          name: Math.random().toString()
        }, {
          where: {
            id: account.get('id')
          }
        }));
    });

    describe('skips update query', () => {
      it('if no data to update', function() {
        const spy = sinon.spy();

        return this.Account.create({ ownerId: 3 }).then(() => {
          return this.Account.update({
            unknownField: 'haha'
          }, {
            where: {
              ownerId: 3
            },
            logging: spy
          });
        }).then(result => {
          expect(result[0]).to.equal(0);
          expect(spy.called, 'Update query was issued when no data to update').to.be.false;
        });
      });

      it('skips when timestamps disabled', function() {
        const Model = this.sequelize.define('Model', {
          ownerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'owner_id'
          },
          name: {
            type: DataTypes.STRING
          }
        }, {
          timestamps: false
        });
        const spy = sinon.spy();

        return Model.sync({ force: true })
          .then(() => Model.create({ ownerId: 3 }))
          .then(() => {
            return Model.update({
              unknownField: 'haha'
            }, {
              where: {
                ownerId: 3
              },
              logging: spy
            });
          })
          .then(result => {
            expect(result[0]).to.equal(0);
            expect(spy.called, 'Update query was issued when no data to update').to.be.false;
          });
      });
    });

    it('changed should be false after reload', function() {
      return this.Account.create({ ownerId: 2, name: 'foo' })
        .then(account => {
          account.name = 'bar';
          expect(account.changed()[0]).to.equal('name');
          return account.reload();
        })
        .then(account => {
          expect(account.changed()).to.equal(false);
        });
    });

    it('should ignore undefined values without throwing not null validation', function() {
      const ownerId = 2;
      return this.Account.create({
        ownerId,
        name: Math.random().toString()
      }).then(account => {
        return this.Account.update({
          name: Math.random().toString(),
          ownerId: undefined
        }, {
          where: {
            id: account.get('id')
          }
        });
      }).then(() => {
        return this.Account.findOne();
      }).then(account => {
        expect(account.ownerId).to.be.equal(ownerId);
      });
    });

    if (_.get(current.dialect.supports, 'returnValues.returning')) {
      it('should return the updated record', function() {
        return this.Account.create({ ownerId: 2 }).then(account => {
          return this.Account.update({ name: 'FooBar' }, {
            where: {
              id: account.get('id')
            },
            returning: true
          }).then(([, accounts]) => {
            const firstAcc = accounts[0];
            expect(firstAcc.ownerId).to.be.equal(2);
            expect(firstAcc.name).to.be.equal('FooBar');
          });
        });
      });
    }

    if (current.dialect.supports['LIMIT ON UPDATE']) {
      it('should only update one row', function() {
        return this.Account.create({
          ownerId: 2,
          name: 'Account Name 1'
        })
          .then(() => {
            return this.Account.create({
              ownerId: 2,
              name: 'Account Name 2'
            });
          })
          .then(() => {
            return this.Account.create({
              ownerId: 2,
              name: 'Account Name 3'
            });
          })
          .then(() => {
            const options = {
              where: {
                ownerId: 2
              },
              limit: 1
            };
            return this.Account.update({ name: 'New Name' }, options);
          })
          .then(account => {
            expect(account[0]).to.equal(1);
          });
      });
    }
  });
});
