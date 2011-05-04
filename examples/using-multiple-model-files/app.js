var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../test/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  , Project   = sequelize.import(__dirname + "/Project")
  , Task      = sequelize.import(__dirname + "/Task")
  
Project.hasMany(Task)
Task.belongsTo(Project)
    
sequelize.sync({force: true}).on('success', function() {
  Project
    .create({ name: 'Sequelize', description: 'A nice MySQL ORM for NodeJS' })
    .on('success', function(project) {
      Task.create({ name: 'Choose a nice MySQL connector', deadline: new Date(), importance: 10 })
        .on('success', function(task1) {
          Task.create({ name: 'Build the rest', deadline: new Date(), importance: 90 })
            .on('success', function(task2) {
              project.setTasks([task1, task2]).on('success', function(tasks) {
                console.log(project)
                console.log(tasks)
              })
            })
        })
    })
})