'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('hasOne'), function() {
  it('properly use the `as` key to generate foreign key name', function(){
    var User = current.define('User', { username: DataTypes.STRING })
      , Task = current.define('Task', { title: DataTypes.STRING });

    User.belongsTo(Task);
    expect(User.attributes.TaskId).not.to.be.empty;

    User.belongsTo(Task, {as : 'Naam'});
    expect(User.attributes.NaamId).not.to.be.empty;
  });
});
