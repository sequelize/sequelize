'use strict';
var Support = require('../support');

before(function() {
  var dialect = Support.getTestDialect();

  if (dialect !== 'postgres' && dialect !== 'postgres-native') {
    return;
  }
  return Support.sequelize.query('CREATE EXTENSION IF NOT EXISTS hstore', null, {raw: true});
});

before(function() {
  var dialect = Support.getTestDialect();

  if (dialect !== 'postgres' && dialect !== 'postgres-native') {
    return;
  }
  return Support.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist', null, {raw: true});
});

beforeEach(function() {
  return Support.clearDatabase(this.sequelize);
});

module.exports = Support;
