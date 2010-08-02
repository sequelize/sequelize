# Sequelize #

The Sequelize library provides easy access to a MySQL database by mapping database entries to objects and vice versa. To put it in a nutshell... it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## Sneak Peak ##

To get the ball rollin' you first have to create an instance of _Sequelize_. Use it the following way:

    var sequelize = new Sequelize('database', 'username', 'password')
  
This will save the passed database credentials and provide all further methods.  
The following lines are showing the basic usage:

    var sequelize = new Sequelize('database', 'username', 'password')
    var Project = sequelize.define('Project', {
      name: Sequelize.STRING,
      description: Sequelize.TEXT
    })
    var Member = sequelize.define('Member', {
      name: Sequelize.STRING,
      firstName: Sequelize.STRING,
      hoursPerWeek: Sequelize.INTEGER
    })
    Project.hasMany('members', Member)
    Member.belongsTo('project', Project)
  
    var p = new Project({
      name: 'my awesome project',
      description: 'foo bar'
    })
    var m = new Project({
      name: 'Depold',
      firstName: 'Sascha',
      hoursPerWeek: 20
    })
    p.save()
    m.save()
    m.updateAttributes({m.projectId: p.id})

... to be completed ...
  