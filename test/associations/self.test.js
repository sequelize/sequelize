/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")

chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Self"), function() {
  it('supports freezeTableName', function (done) {
    var Group = this.sequelize.define('Group', {

    }, {
      tableName: 'user_group',
      timestamps: false,
      underscored: true,
      freezeTableName: true
    });

    Group.belongsTo(Group, { as: 'Parent', foreignKey: 'parent_id' });
    Group.sync({force: true}).done(function (err) {
      expect(err).not.to.be.ok
      Group.findAll({
        include: [{
          model: Group,
          as: 'Parent'
        }]
      }).done(function (err) {
        expect(err).not.to.be.ok
        done()
      })
    })
  })
})