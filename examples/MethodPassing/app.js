var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "test", "test", {disableLogging: true})

// model definition    
var Task = sequelize.define("Task", {
  name: Sequelize.STRING,
  deadline: Sequelize.DATE,
  importance: Sequelize.INTEGER
}, {
  classMethods: {
    setImportance: function(newImportance, callback) {
      Task.findAll(function(allTasks) {
        var queries = []
        allTasks.forEach(function(task) {
          queries.push({updateAttributes: task, params: [{ importance: newImportance }]})
        })
        Sequelize.chainQueries(queries, callback)
      })
    }
  },
  instanceMethods: {
    hasDeadlinePassed: function() {
      return (this.deadline < new Date())
    }
  }
})

// instance creation
var task1 = new Task({
      name: 'Choose a nice MySQL connector',
      deadline: new Date(Date.parse("Jul 8, 2100")),
      importance: 10
    }),
    task2 = new Task({
      name: 'Build the rest',
      deadline: new Date(Date.parse("Jul 8, 2005")),
      importance: 90
    })

Task.drop(function(table, error) {
  if(error) return Sequelize.Helper.log(error)

  Task.sync(function(table, error) {
    if(error) return Sequelize.Helper.log(error)
    
    task1.save(function() {
      task2.save(function() {
        
        Sequelize.Helper.log("should be false: " + task1.hasDeadlinePassed())
        Sequelize.Helper.log("should be true: " + task2.hasDeadlinePassed())
        Sequelize.Helper.log("should be 10: " + task1.importance)
        
        Task.setImportance(30, function() {
          Task.findAll(function(tasks) {
            tasks.forEach(function(task) {
              Sequelize.Helper.log("should be 30: " + task.importance)
            })
          })
        })
        
      })
    })
  })
})