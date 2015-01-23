'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

chai.config.includeStack = true;

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Connector Manager', function() {

    it('should handle different databases', function() {
      var self = this;
      var User = this.sequelize.define('UserXYZ', {
        username: DataTypes.STRING,
        gender: DataTypes.STRING
      }, {
        timestamps: false,
        schema: 'foo',
        database: 'databaseA'
      });

      var Task = this.sequelize.define('TaskXYZ', {
        title: DataTypes.STRING,
        status: DataTypes.STRING
      }, {
        timestamps: false,
        schema: 'bar',
        database: 'databaseB'
      });

      Task.belongsTo(User);

      return self.sequelize.dropAllSchemas()
      .then(function() {
        return self.sequelize.createSchema({
          database: 'databaseA',
          schema: 'foo'
        });
      })
      .then(function() {
        return self.sequelize.createSchema({
          database: 'databaseB',
          schema: 'bar'
        });
      })
      .then(function() {
        return self.sequelize.sync({ force: true });
      })
      .then(function() {
        return Promise.all([
          User.create({ username: 'foo', gender: 'male' }),
          Task.create({ title: 'task', status: 'inactive' })
        ]);
      })
      .spread(function(user, task) {
        return task.setUserXYZ(user).then(function() {
          return task.getUserXYZ();
        });
      }).then(function(user) {
        expect(user).to.be.ok;
      });

    });

  });
}
