/*
  Title: Defining class and instance methods

  This example shows the usage of the classMethods and instanceMethods option for Models.
*/

var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../spec/config/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

// model definition
var Task = sequelize.define("Task", {
  name: Sequelize.STRING,
  deadline: Sequelize.DATE,
  importance: Sequelize.INTEGER
}, {
  classMethods: {
    setImportance: function(newImportance, callback) {
      Task.findAll().on('success', function(allTasks) {
        var chainer = new Sequelize.Utils.QueryChainer
        allTasks.forEach(function(task) {
          chainer.add(task.updateAttributes({ importance: newImportance }))
        })
        chainer.run().on('success', function() {
          callback && callback()
        })
      })
    }
  },
  instanceMethods: {
    passedDeadline: function() {
      return (this.deadline < new Date())
    }
  }
})

// instance creation
var task1 = Task.build({
      name: 'Choose a nice MySQL connector',
      deadline: new Date(Date.parse("Jul 8, 2100")),
      importance: 10
    }),
    task2 = Task.build({
      name: 'Build the rest',
      deadline: new Date(Date.parse("Jul 8, 2005")),
      importance: 90
    })

Task.sync({force: true}).on('success', function() {
  new Sequelize.Utils.QueryChainer([task1.save(), task2.save()]).run().on('success', function() {
    console.log("should be false: " + task1.passedDeadline())
    console.log("should be true: " + task2.passedDeadline())
    console.log("should be 10: " + task1.importance)

    Task.setImportance(30, function() {
      Task.findAll().on('success', function(tasks) {
        tasks.forEach(function(task) {
          console.log("should be 30: " + task.importance)
        })
      })
    })
  })
})