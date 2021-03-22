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

  afterEach(async function() {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('dropEnum', () => {
    beforeEach(async function() {
      await this.queryInterface.createTable('menus',  {
        structuretype: DataTypes.ENUM('menus', 'submenu', 'routine'),
        sequence: DataTypes.INTEGER,
        name: DataTypes.STRING
      });
    });

    if (dialect === 'postgres') {
      it('should be able to drop the specified enum', async function() {
        await this.queryInterface.removeColumn('menus', 'structuretype');
        const enumList0 = await this.queryInterface.pgListEnums('menus');
        expect(enumList0).to.have.lengthOf(1);
        expect(enumList0[0]).to.have.property('enum_name').and.to.equal('enum_menus_structuretype');
        await this.queryInterface.dropEnum('enum_menus_structuretype');
        const enumList = await this.queryInterface.pgListEnums('menus');
        expect(enumList).to.be.an('array');
        expect(enumList).to.have.lengthOf(0);
      });
    }
  });
});
