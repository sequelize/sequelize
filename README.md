# Sequelize #

The Sequelize library provides easy access to a MySQL database by mapping database entries to objects and vice versa. To put it in a nutshell... it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## Installation ##

Sequelize will have a Kiwi package in future. For now, you can install it via NPM or just download the code from the git repository and require _sequelize.js_:

    #npm:
    npm install sequelize

    #checkout:
    require(__dirname + "/path/to/sequelize/sequelize")

This will make the class Sequelize available.

## Basic Mapping ##

To get the ball rollin' you first have to create an instance of _Sequelize_. Use it the following way:

    var sequelize = new Sequelize('database', 'username', 'password')
  
This will save the passed database credentials and provide all further methods.  

To define mappings between a class (_Stop telling me that JavaScript don't know classes. Name it however you want to!_) and a table use the _define_ method:
    
    var Project = sequelize.define('Project', {
      title: Sequelize.STRING,
      description: Sequelize.TEXT
    })
    
    var Task = sequelize.define('Task', {
      title: Sequelize.STRING,
      description: Sequelize.TEXT,
      deadline: Sequelize.DATE
    })

## Creation and deletion of class tables ##

As you are able to specify an objects _skeleton_, the next step is to push it to a database:

    // create my nice tables:
    Project.sync(callback)
    Task.sync(callback)
    
    // drop the tables:
    Project.drop(callback)
    Task.drop(callback)

Because synchronizing and dropping all of your tables might be a lot of line to write, you can also let Sequelize do the work for you:

    // create all tables... now!
    sequelize.sync(callback)
    
    // and drop it!
    sequelize.drop(callback)

## Creating and working with instances ##

In order to create instances of defined classes just do it as follows:

    var project = new Project({
      title: 'my awesome project',
      description: 'woot woot. this will make me a rich man'
    })
    
    var task = new Task({
      title: 'specify the project idea',
      description: 'bla',
      deadline: new Date()
    })

To save it in the database use the _save_ method and pass a callback to it, if needed:

    project.save(function() {
      // my nice callback stuff
    })
    
    task.save(function() {
      // some other stuff
    })
    
    new Task({ title: 'foo', description: 'bar', deadline: new Date()}).save(function(anotherTask) {
      // you can now access the currently saved task with the variable _anotherTask_... nice!
    })

Now lets change some values and save changes to the database... There are two ways to do that:

    // way 1
    task.title = 'a very different title now'
    task.save(function(){})
    
    // way 2
    task.updateAttributes({
      title: 'a very different title now'
    }, function(){})

## Chain queries ##
    
Because you will want to save several items at once and just go on after all of them are saved, Sequelize provides a handy helper for that:

    Sequelize.chainQueries([
      // push your items + method calls here
    ], function() {
      // and here do some callback stuff
    })

And a real example:

    Sequelize.chainQueries([ 
      {save: project}, {save: task}
    ], function() {
      // woot! saved.
    })

You can also pass params to the method... and of course you can also call other methods with a callback: 

    Sequelize.chainQueries([
      { methodWithParams: project, params: [1,2,3] }
    ], function() {
      // the method call will equal: project.methodWithParams(1,2,3, callback)
    })

## Associations ##

With Sequelize you can also specify associations between multiple classes. Doing so will help you to easily access and set those associated objects. The library therefore provides for each defined class the method _belongsTo_, _hasOne_ and _hasMany_:

    Project.hasMany("tasks", Task)
    Task.belongsTo("project", Project)
    
Because Sequelize is doing a lot of magic, you have to call Sequelize#sync *after* setting the associations! Doing so will allows you the following:

    var project = new Project...
    var task1 = new Task...
    var task2 = new Task
    
    // save them... and then:
    project.setTasks([task1, task2], function(associatedTasks) {
      // the associatedTasks are the very same as task1 and task2
    })
    
    // ok now they are save... how do I get them later on?
    project.tasks(function(associatedTasks) {
      // bam
    })
    
To remove created associations you can just call the _set_ method without a specific id:

    // remove task1 (only the association!)
    project.setTasks([task2], function(associatedTasks) {
      // you will get task2 only
    })
    
    // remove 'em all
    projects.setTasks([], function(associatedTasks) {
      // you will get an empty array
    })
  
You can also do it vice versa:

    // project is associated with task1 and task2
    task2.setProject(null, function(associatedProject) {
      // will return no associations
    })

For hasOne its basically the same as with belongsTo:

    Task.hasOne('author', Author)
    Task.setAuthor(anAuthor)

In order to specify many-to-many associations you can use the following syntax:

    Project.hasMany('members', Member)
    Member.hasMany('projects', Project)

This will create a table named according to the table names of Project and Member (= ProjectsMembers) which just stores the id of a project and a member. Don't forget to call the sync method of the sequelize instance.

## Finding some objects ##

OK... you can define classes and associations. You can save them. You would probably like to get them from the database again :) Easy:

    Project.find(123, function(project) {
      // project will be an instance of Project and stores the content of the table entry with id 123
      // if such an entry is not defined you will get null
    })
    
    Project.find({ title: 'aProject' }, function(project) {
      // project will be the first entry of the Projects table with the title 'aProject' || null
    })
    
    Project.findAll(function(projects) {
      // projects will be an array of all Project instances
    })

# TODO #
- deletion dependencies
- restrictions
- migrations (changing a tables structure without deleting information)
- make findAll with conditions easier to use
- NPM/Kiwi package