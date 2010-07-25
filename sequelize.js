/*
  var sequelize = new require('sequelize').sequelize(database, username[, password])
  var Tag = sequelize.define('Tag', {title: sequelize.TEXT, createdAt: sequelize.DATE})
  var t = new Tag({title: 'Office-Stuff', createdAt: new Date()})
  t.save(function() {
    callback
  })
*/

require(__dirname + "/src/Sequelize")
