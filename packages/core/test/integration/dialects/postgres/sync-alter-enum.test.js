'use strict';

const chai = require('chai');

const assert = chai.assert;
const Support = require('../../support');

const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

if (dialect === 'postgres') {
  describe('[POSTGRES Specific] sync with alter method with dataType enum', () => {
    it('properly sync, #7649', async function () {
      this.sequelize.define('Media', {
        type: DataTypes.ENUM([
          'video', 'audio',
        ]),
      });

      await this.sequelize
        .sync({ alter: true })
        .catch(error => {
          assert.fail(error.message);
        });

      this.sequelize.define('Media', {
        type: DataTypes.ENUM([
          'image', 'video', 'audio',
        ]),
      });

      await this.sequelize
        .sync({ alter: true })
        .catch(error => {
          assert.fail(error.message);
        });
    });
    it('properly sync with schema, #7649', async function () {
      await this.sequelize.queryInterface.createSchema('testschema');

      this.sequelize.define('Media', {
        type: DataTypes.ENUM([
          'video', 'audio',
        ]),
      }, {
        schema: 'testschema',
      });

      await this.sequelize
        .sync({ alter: true })
        .catch(error => {
          assert.fail(error.message);
        });

      this.sequelize.define('Media', {
        type: DataTypes.ENUM([
          'image', 'video', 'audio',
        ]),
      }, {
        schema: 'testschema',
      });

      await this.sequelize
        .sync({ alter: true })
        .catch(error => {
          assert.fail(error.message);
        });

      await this.sequelize.queryInterface.dropSchema('testschema');
    });
  });
}
