var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "test", "test"),
    Project   = sequelize.import(__dirname + "/Project").Project,
    Task      = sequelize.import(__dirname + "/Task").Task
  
Project.hasMany('tasks', Task)
Task.belongsTo('project', Project)
    
sequelize.drop(function(errors) {
  if(errors.length > 0) return Sequelize.Helper.log(errors)

  sequelize.sync(function(errors) {
    if(errors.length > 0) return Sequelize.Helper.log(errors)
    
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