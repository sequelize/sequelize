'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');
const _ = require('lodash');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] QueryInterface', () => {
    beforeEach(function () {
      this.sequelize.options.quoteIdenifiers = true;
      this.queryInterface = this.sequelize.getQueryInterface();
    });

    describe('indexes', () => {
      beforeEach(function () {
        const self = this;
        return this.queryInterface.dropTable('Group').then(() => self.queryInterface.createTable('Group', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN,
          from: DataTypes.STRING
        }));
      });

      it('adds, reads and removes a named functional index to the table', function () {
        const self = this;
        return this.queryInterface.addIndex('Group', [this.sequelize.fn('lower', this.sequelize.col('username'))], {
          name: 'group_username_lower'
        }).then(() => self.queryInterface.showIndex('Group').then(indexes => {
          let indexColumns = _.uniq(indexes.map(index => index.name));
          expect(indexColumns).to.include('group_username_lower');
          return self.queryInterface.removeIndex('Group', 'group_username_lower').then(() => self.queryInterface.showIndex('Group').then(indexes => {
            indexColumns = _.uniq(indexes.map(index => index.name));
            expect(indexColumns).to.be.empty;
          }));
        }));
      });
    });
  });
}
