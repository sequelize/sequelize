'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('../../../lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function() {
    return Support.dropTestSchemas(this.sequelize);
  });

  describe('dropEnum', () => {
    beforeEach(function() {
      return this.queryInterface.createTable('menus',  {
        structuretype: {
          type: DataTypes.ENUM('menus', 'submenu', 'routine'),
          allowNull: true
        },
        sequence: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: true
        }
      });
    });

    if (dialect === 'postgres') {
      it('should be able to drop the specified enum', function() {
        return this.queryInterface.removeColumn('menus', 'structuretype').then(() => {
          return this.queryInterface.pgListEnums('menus');
        }).then(enumList => {
          expect(enumList).to.have.lengthOf(1);
          expect(enumList[0]).to.have.property('enum_name').and.to.equal('enum_menus_structuretype');
        }).then(() => {
          return this.queryInterface.dropEnum('enum_menus_structuretype');
        }).then(() => {
          return this.queryInterface.pgListEnums('menus');
        }).then(enumList => {
          expect(enumList).to.be.an('array');
          expect(enumList).to.have.lengthOf(0);
        });
      });
    }
  });
});
