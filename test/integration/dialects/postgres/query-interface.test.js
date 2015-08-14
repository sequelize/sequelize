'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , _ = require('lodash');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] QueryInterface', function () {
    beforeEach(function () {
      this.sequelize.options.quoteIdenifiers = true;
      this.queryInterface = this.sequelize.getQueryInterface();
    });

    describe('indexes', function () {
      beforeEach(function () {
        var self = this;
        return this.queryInterface.dropTable('Group').then(function () {
          return self.queryInterface.createTable('Group', {
            username: DataTypes.STRING,
            isAdmin: DataTypes.BOOLEAN,
            from: DataTypes.STRING
          });
        });
      });

      it('adds, reads and removes a named functional index to the table', function () {
        var self = this;
        return this.queryInterface.addIndex('Group', [this.sequelize.fn('lower', this.sequelize.col('username'))], {
          name: 'group_username_lower'
        }).then(function () {
          return self.queryInterface.showIndex('Group').then(function (indexes) {
            var indexColumns = _.uniq(indexes.map(function (index) {
              return index.name;
            }));
            expect(indexColumns).to.include('group_username_lower');
            return self.queryInterface.removeIndex('Group', 'group_username_lower').then(function () {
              return self.queryInterface.showIndex('Group').then(function (indexes) {
                indexColumns = _.uniq(indexes.map(function (index) {
                  return index.name;
                }));
                expect(indexColumns).to.be.empty;
              });
            });
          });
        });
      });
    });
  });
}
