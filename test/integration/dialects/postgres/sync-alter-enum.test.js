'use strict';

const chai = require('chai'),
  assert = chai.assert,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect();

if (dialect !== 'postgres') {
  return;
}

describe('[POSTGRES Specific] sync with alter method with dataType enum', () => {
  it('properly sync, #7649', async function() {
    this.sequelize.define('Media', {
      type: Sequelize.ENUM([
        'video', 'audio'
      ])
    });

    await this.sequelize
      .sync({ alter: true })
      .catch(err => {
        assert.fail(err.message);
      });

    this.sequelize.define('Media', {
      type: Sequelize.ENUM([
        'image', 'video', 'audio'
      ])
    });

    await this.sequelize
      .sync({ alter: true })
      .catch(err => {
        assert.fail(err.message);
      });
  });
  it('properly sync with schema, #7649', async function() {
    await this.sequelize.queryInterface.createSchema('testschema');

    this.sequelize.define('Media', {
      type: Sequelize.ENUM([
        'video', 'audio'
      ])
    }, {
      schema: 'testschema'
    });

    await this.sequelize
      .sync({ alter: true })
      .catch(err => {
        assert.fail(err.message);
      });

    this.sequelize.define('Media', {
      type: Sequelize.ENUM([
        'image', 'video', 'audio'
      ])
    }, {
      schema: 'testschema'
    });

    await this.sequelize
      .sync({ alter: true })
      .catch(err => {
        assert.fail(err.message);
      });

    await this.sequelize.queryInterface.dropSchema('testschema');
  });
});
