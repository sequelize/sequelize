## Associations

With Sequelize you can also specify associations between multiple classes&period; Doing so will help you to easily access and set those associated objects&period; The library therefore provides for each defined class different methods&comma; which are explained in the following chapters&period;

**Note&colon; **Associations with models that use custom primaryKeys &lpar;so not the field 'id'&rpar; are currently unsupported&period;

### One-To-One associations

One-To-One associations are connecting one source with exactly one target&period; In order to define a proper database schema&comma; Sequelize utilizes the methods `belongsTo` and `hasOne`&period; You can use them as follows&colon;
    
    var User = sequelize.define('User', {/* ... */})
    var Project = sequelize.define('Project', {/* ... */})
     
    // One-way associations
    Project.hasOne(User)
     
    /*
      In this example hasOne will add an attribute ProjectId to the User model!
      Furthermore, Project.prototype will gain the methods getUser and setUser according
      to the first parameter passed to define. If you have underscore style
      enabled, the added attribute will be project_id instead of ProjectId.
     
      You can also define the foreign key, e.g. if you already have an existing
      database and want to work on it:
    */
     
    Project.hasOne(User, { foreignKey: 'initiator_id' })
     
    /*
      Because Sequelize will use the model's name (first parameter of define) for
      the accessor methods, it is also possible to pass a special option to hasOne:
    */
     
    Project.hasOne(User, { as: 'Initiator' })
    // Now you will get Project#getInitiator and Project#setInitiator
     
    // Or let's define some self references
    var Person = sequelize.define('Person', { /* ... */})
     
    Person.hasOne(Person, {as: 'Father'})
    // this will add the attribute FatherId to Person
     
    // also possible:
    Person.hasOne(Person, {as: 'Father', foreignKey: 'DadId'})
    // this will add the attribute DadId to Person
     
    // In both cases you will be able to do:
    Person#setFather
    Person#getFather
     
    // If you need to join a table twice you can double join the same table
    Team
      .hasOne(Game, {foreignKey : 'homeTeamId'});
      .hasOne(Game, {foreignKey : 'awayTeamId'});
    Game
      .belongsTo(Team);
     
     
    // Since v1.3.0 you can also chain associations:
    Project
      .hasOne(User)
      .hasOne(Deadline)
      .hasOne(Attachment)

To get the association working the other way around &lpar;so from`User`to`Project`&rpar;&comma; it's necessary to do this&colon;
    
    var User = sequelize.define('User', {/* ... */})
    var Project = sequelize.define('Project', {/* ... */})
     
    // One-way back associations
    Project.belongsTo(User)
     
    /*
      In this example belongsTo will add an attribute UserId to the Project model!
      That's the only difference to hasMany. Self references are working the very same way!
    */

### One-To-Many associations

One-To-Many associations are connecting one source with multiple targets&period; The targets however are again connected to exactly one specific source&period;
    
    var User = sequelize.define('User', {/* ... */})
    var Project = sequelize.define('Project', {/* ... */})
     
    // OK. Now things get more complicated (not really visible to the user :)).
    // First let's define a hasMany association
    Project.hasMany(User, {as: 'Workers'})

This will add the attribute ProjectId or project\_id to User. Instances of Project will get the accessors getWorkers and setWorkers. 
We could just leave it the way it is and let it be a one-way association.
But we want more! Let's define it the other way around by creating a many to many assocation in the next section:

### Many-To-Many associations

Many-To-Many associations are used to connect sources with multiple targets&period; Furthermore the targets can also have connections to multiple sources&period;
    
    // again the Project association to User
    Project.hasMany(User, { as: 'Workers' })
     
    // now comes the association between User and Project
    User.hasMany(Project)
     
    /*
      This will remove the attribute ProjectId (or project_id) from User and create
      a new model called ProjectsUsers with the equivalent foreign keys ProjectId
      (or project_id) and UserId (or user_id). If the attributes are camelcase or
      not depends on the Model it represents.
     
      Now you can use Project#getWorkers, Project#setWorkers, User#getTasks and
      User#setTasks.
    */
     
    // Of course you can also define self references with hasMany:
     
    Person.hasMany(Person, { as: 'Children' })
    // This will create the table ChildrenPersons which stores the ids of the objects.
     
    // Since v1.5.0 you can also reference the same Model without creating a junction
    // table (but only if each object will have just one 'parent'). If you need that,
    // use the option foreignKey and set through to null
    Person.hasMany(Person, { as: 'Children', foreignKey: 'ParentId', through: null })
     
    // You can also use a predefined junction table using the option through:
    Project.hasMany(User, {through: 'project_has_users'})
    User.hasMany(Project, {through: 'project_has_users'})

If you want additional attributes in your join table&comma; you can define a model for the join table in sequelize&comma; before you define the association&comma; and then tell sequelize that it should use that model for joining&comma; instead of creating a new one&colon;
    
    User = sequelize.define('User', {})
    Project = sequelize.define('Project', {})
    UserProjects = sequelize.define('UserProjects', {
        status: DataTypes.STRING
    })
     
    User.hasMany(Project, { through: UserProjects })
    Project.hasMany(User, { through: UserProjects })

The code above will add ProjectId and UserId to the UserProjects table&comma; and_remove any previsouly defined primary key attribute_&comma; - the table will be uniquely identified by the combination of the keys of the two tables&comma; and there is no reason to have other PK columns&period;

### Associating objects

Because Sequelize is doing a lot of magic&comma; you have to call`Sequelize&num;sync`after setting the associations&excl; Doing so will allow you the following&colon;
    
    Project.hasMany(Task)
    Task.hasMany(Project)
     
    Project.create()...
    Task.create()...
    Task.create()...
     
    // save them... and then:
    project.setTasks([task1, task2]).success(function() {
      // saved!
    })
     
    // ok now they are save... how do I get them later on?
    project.getTasks().success(function(associatedTasks) {
      // associatedTasks is an array of tasks
    })
     
    // You can also pass filters to the getter method.
    // They are equal to the options you can pass to a usual finder method.
    project.getTasks({ where: 'id > 10' }).success(function(tasks) {
      // tasks with an id greater than 10 :)
    })
     
    // You can also only retrieve certain fields of a associated object.
    // This example will retrieve the attibutes "title" and "id"
    project.getTasks({attributes: ['title']}).success(function(tasks) {
      // tasks with an id greater than 10 :)
    })

To remove created associations you can just call the set method without a specific id&colon;
    
    // remove the association with task1
    project.setTasks([task2]).success(function(associatedTasks) {
      // you will get task2 only
    })
     
    // remove 'em all
    project.setTasks([]).success(function(associatedTasks) {
      // you will get an empty array
    })
     
    // or remove 'em more directly
    project.removeTask(task1).success(function() {
      // it's gone
    })
     
    // and add 'em again
    project.addTask(task1).success(function() {
      // it's back again
    })

You can of course also do it vice versa&colon;
    
    // project is associated with task1 and task2
    task2.setProject(null).success(function() {
      // and it's gone
    })

For hasOne&sol;belongsTo its basically the same&colon;
    
    Task.hasOne(User, {as: "Author"})
    Task#setAuthor(anAuthor)

Adding associations to a relation with a custom join table can be done in two ways &lpar;continuing with the associations defined in the previous chapter&rpar;&colon;
    
    // Either by adding a property with the name of the join table model to the object, before creating the association
    project.UserProjects = {
      status: 'active'
    }
    u.addProject(project)
     
    // Or by providing a second argument when adding the association, containing the data that should go in the join table
    u.addProject(project, { status: 'active' })
     
     
    // When associating multiple objects, you can combine the two options above. In this case the second argument
    // will be treated as a defaults object, that will be used if no data is provided
    project1.UserProjects = {
        status: 'inactive'
    }
     
    u.setProjects([project1, project2], { status: 'active' })
    // The code above will record inactive for project one, and active for project two in the join table

When getting data on an association that has a custom join table&comma; the data from the join table will be returned as a DAO instance&colon;
    
    u.getProjects().success(function(projects) {
      var project = projects[0]
     
      if (project.UserProjects.status === 'active') {
        // .. do magic
     
        // since this is a real DAO instance, you can save it directly after you are done doing magic
        project.UserProjects.save()
      }
    })

If you only need some of the attributes from the join table&comma; you can provide an array with the attributes you want&colon;
    
    // This will select only name from the Projects table, and only status from the UserProjects table
    user.getProjects({ attributes: ['name'], joinTableAttributes: ['status']})

### Check associations

Sequelize`v1&period;5&period;0`introduced methods which allows you&comma; to check if an object is already associated with another one &lpar;N&colon;M only&rpar;&period; Here is how you'd do it&colon;
    
    // check if an object is one of associated ones:
    Project.create({ /* */ }).success(function(project) {
      User.create({ /* */ }).success(function(user) {
        project.hasUser(user).success(function(result) {
          // result would be false
          project.addUser(user).success(function() {
            project.hasUser(user).success(function(result) {
              // result would be true
            })
          })
        })
      })
    })
     
    // check if all associated objects are as expected:
    // let's assume we have already a project and two users
    project.setUsers([user1, user2]).success(function() {
      project.hasUsers([user1]).success(function(result) {
        // result would be false
        project.hasUsers([user1, user2]).success(function(result) {
          // result would be true
        })
      })
    })

### Foreign Keys

When you create associations between your models in sequelize, foreign key references with constraints will automatically be created. The setup below:
    
    var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
      , User = this.sequelize.define('User', { username: Sequelize.STRING })
     
    User.hasMany(Task)
    Task.belongsTo(User)

Will generate the following SQL:
    
    CREATE TABLE IF NOT EXISTS `User` (
      `id` INTEGER PRIMARY KEY, 
      `username` VARCHAR(255)
    );
     
    CREATE TABLE IF NOT EXISTS `Task` (
      `id` INTEGER PRIMARY KEY, 
      `title` VARCHAR(255), 
      `user_id` INTEGER
    );

To add references constraints to the columns, you can pass the options `onUpdate`and`onDelete`to the association calls. The validation options are`RESTRICT, CASCADE, NO ACTION, SET DEFAULT, SET NULL`, for example:
    
    User.hasMany(Task, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })

    CREATE TABLE IF NOT EXISTS `Task` (
      `id` INTEGER PRIMARY KEY, 
      `title` VARCHAR(255), 
      `user_id` INTEGER REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
    );

#### Enforcing a foreign key reference without constraints

Some times you may want to reference another table, without adding any constraints, or associations. In that case you can manually add the reference attributes to your schema definition
, and mark the relations between them.
    
    var Series, Trainer, Video
     
    // Series has a trainer_id=Trainer.id foreign reference key after we call Trainer.hasMany(series)
    Series = sequelize.define('Series', {
      title:        DataTypes.STRING,
      sub_title:    DataTypes.STRING,
      description:  DataTypes.TEXT,
     
      // Set FK relationship (hasMany) with `Trainer`
      trainer_id: {
        type: DataTypes.INTEGER,
        references: "Trainer",
        referencesKey: "id"
      }
    })
     
    Trainer = sequelize.define('Trainer', {
      first_name: DataTypes.STRING,
      last_name:  DataTypes.STRING
    });
     
    // Video has a series_id=Series.id foreign reference key after we call Series.hasOne(Video)...
    Video = sequelize.define('Video', {
      title:        DataTypes.STRING,
      sequence:     DataTypes.INTEGER,
      description:  DataTypes.TEXT,
     
      // set relationship (hasOne) with `Series`
      series_id: {
        type: DataTypes.INTEGER,
        references: Series, // Can be both a string representing the table name, or a reference to the model
        referencesKey: "id"
      }
    });
     
    Series.hasOne(Video);
    Trainer.hasMany(Series);
