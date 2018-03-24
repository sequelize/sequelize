'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    beforeEach(function() {
      this.ScopeMe = this.sequelize.define('ScopeMe', {
        username: Sequelize.STRING,
        email: Sequelize.STRING,
        access_level: Sequelize.INTEGER,
        other_value: Sequelize.INTEGER
      }, {
        scopes: {
          lowAccess: {
            attributes: ['other_value', 'access_level'],
            where: {
              access_level: {
                lte: 5
              }
            }
          },
          withName: {
            attributes: ['username']
          },
          highAccess: {
            where: {
              [Sequelize.Op.or]: [
                { access_level: { [Sequelize.Op.gte]: 5 } },
                { access_level: { [Sequelize.Op.eq]: 10 } }
              ]
            }
          },
          lessThanFour: {
            where: {
              [Sequelize.Op.and]: [
                { access_level: { [Sequelize.Op.lt]: 4 } }
              ]
            }
          },
          issue8473: {
            where: {
              [Sequelize.Op.or]: {
                access_level: 3,
                other_value: 10
              },
              access_level: 5
            }
          }
        }
      });

      return this.sequelize.sync({force: true}).then(() => {
        const records = [
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
          {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7}
        ];
        return this.ScopeMe.bulkCreate(records);
      });
    });

    it('should be able to merge attributes as array', function() {
      return this.ScopeMe.scope('lowAccess', 'withName').findOne()
        .then(record => {
          expect(record.other_value).to.exist;
          expect(record.username).to.exist;
          expect(record.access_level).to.exist;
        });
    });

    it('should work with Symbol operators', function() {
      return this.ScopeMe.scope('highAccess').findOne()
        .then(record => {
          expect(record.username).to.equal('tobi');
          return this.ScopeMe.scope('lessThanFour').findAll();
        })
        .then(records => {
          expect(records).to.have.length(2);
          expect(records[0].get('access_level')).to.equal(3);
          expect(records[1].get('access_level')).to.equal(3);
          return this.ScopeMe.scope('issue8473').findAll();
        })
        .then(records => {
          expect(records).to.have.length(1);
          expect(records[0].get('access_level')).to.equal(5);
          expect(records[0].get('other_value')).to.equal(10);
        });
    });

    it('should keep symbols after default assignment', function() {
      return this.ScopeMe.scope('highAccess').findOne()
        .then(record => {
          expect(record.username).to.equal('tobi');
          return this.ScopeMe.scope('lessThanFour').findAll({
            where: {}
          });
        })
        .then(records => {
          expect(records).to.have.length(2);
          expect(records[0].get('access_level')).to.equal(3);
          expect(records[1].get('access_level')).to.equal(3);
          return this.ScopeMe.scope('issue8473').findAll();
        });
    });
  });
});
