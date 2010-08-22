var Sequelize = require(__dirname + "/../../src/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "test", "test"),
    Project   = require(__dirname + "/Project").getProjectClass(Sequelize, sequelize),
    Task      = require(__dirname + "/Task").getTaskClass(Sequelize, sequelize)
  
Project.hasMany('tasks', Task)
Task.belongsTo('project', Project)

Sequelize.Helper.log(Project)
Sequelize.Helper.log(Task)

    
sequelize.drop(function() {
  sequelize.sync(function() {
    new Project({
      name: 'Sequelize',
      description: 'A nice MySQL ORM for NodeJS'
    }).save(function(project) {
      var task1 = new Task({
        name: 'Choose a nice MySQL connector',
        deadline: new Date(),
        importance: 10
      })
      var task2 = new Task({
        name: 'Build the rest',
        deadline: new Date(),
        importance: 90
      })
      Sequelize.chainQueries([{save: task1}, {save: task2}], function() {
        project.setTasks([task1, task2], function(tasks) {
          Sequelize.Helper.log(project)
          Sequelize.Helper.log(tasks)
        })
      })
    })
  })
})