'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('scope', function () {
    beforeEach(function () {
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
           }
         }
      });

      return this.sequelize.sync({force: true}).then(function() {
        var records = [
          {username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7},
          {username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11},
          {username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10},
          {username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7}
        ];
        return this.ScopeMe.bulkCreate(records);
      }.bind(this));
    });

    it('should be able to merge attributes as array', function () {
      return this.ScopeMe.scope('lowAccess','withName').findOne()
              .then(function(record){
                expect(record.other_value).to.exist;
                expect(record.username).to.exist;
                expect(record.access_level).to.exist;
              });
    });
  });
});
