## One-To-One associations
One-To-One associations are associations between exactly two models connected by a single foreign key.

### BelongsTo

BelongsTo associations are associations where the foreign key for the one-to-one relation exists on the **source model**.

A simple example would be a **User** being part of a team **Team** with the foreign key on user.

```js
var Player = this.sequelize.define('Player', {/* attributes */})
  , Team  = this.sequelize.define('Team', {/* attributes */});
  
Player.belongsTo(Team); // Will add a TeamId attribute to Player to hold the primary key value for Team
```

#### Foreign keys

By default the foreign key for a belongsTo relation will be generated from the target model name and the target primary key name.

The default casing is `camelCase` however if the source model is configured with `underscored: true` the foreignKey will be `snake_case`.

```js
var User = this.sequelize.define('User', {/* attributes */})
  , Company  = this.sequelize.define('Company', {/* attributes */});
  
User.belongsTo(Company); // Will add CompanyId to user

var User = this.sequelize.define('User', {/* attributes */}, {underscored: true})
  , Company  = this.sequelize.define('Company', {
    uuid: {
      type: Sequelize.UUID,
      primaryKey: true
    }
  });
  
User.belongsTo(Company); // Will add company_uuid to user
```

In cases where `as` has been defined it will be used in place of the target model name.

```js
var User = this.sequelize.define('User', {/* attributes */})
  , UserRole  = this.sequelize.define('UserRole', {/* attributes */});
  
User.belongsTo(UserRole, {as: 'Role'}); // Adds RoleId to user rather than UserRoleId
```

In all cases the default foreign key can be overwritten with the `foreignKey` option.
When the foreign key option is used, Sequelize will use it as-is:

```js
var User = this.sequelize.define('User', {/* attributes */})
  , Company  = this.sequelize.define('Company', {/* attributes */});
  
User.belongsTo(Company, {foreignKey: 'fk_company'}); // Adds fk_company to User
```


### HasOne

HasOne associations are associations where the foreign key for the one-to-one relation exists on the **target model**.

```js
var User = sequelize.define('User', {/* ... */})
var Project = sequelize.define('Project', {/* ... */})
 
// One-way associations
Project.hasOne(User)
 
/*
  In this example hasOne will add an attribute ProjectId to the User model!
  Furthermore, Project.prototype will gain the methods getUser and setUser according
  to the first parameter passed to define. If you have underscore style
  enabled, the added attribute will be project_id instead of ProjectId.
  
  The foreign key will be placed on the users table.
  
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
Team.hasOne(Game, {as: 'HomeTeam', foreignKey : 'homeTeamId'});
Team.hasOne(Game, {as: 'AwayTeam', foreignKey : 'awayTeamId'});

Game.belongsTo(Team);
```

Even though it is called a HasOne association, for most 1:1 relations you usually want the BelongsTo association since BelongsTo will add the foreignKey on the source where hasOne will add on the target.

## One-To-Many associations

One-To-Many associations are connecting one source with multiple targets. The targets however are again connected to exactly one specific source.
```js
var User = sequelize.define('User', {/* ... */})
var Project = sequelize.define('Project', {/* ... */})
 
// OK. Now things get more complicated (not really visible to the user :)).
// First let's define a hasMany association
Project.hasMany(User, {as: 'Workers'})
```

This will add the attribute ProjectId or `project_id` to User. Instances of Project will get the accessors getWorkers and setWorkers.  We could just leave it the way it is and let it be a one-way association.
But we want more! Let's define it the other way around by creating a many to many association in the next section:

## Belongs-To-Many associations

Belongs-To-Many associations are used to connect sources with multiple targets. Furthermore the targets can also have connections to multiple sources.
    
```js
Project.belongsToMany(User, {through: 'UserProject'});
User.belongsToMany(Project, {through: 'UserProject'});
```

This will create a new model called UserProject with with the equivalent foreign keys `ProjectId` and `UserId`. Whether the attributes are camelcase or not depends on the two models joined by the table (in this case User and Project).

Defining `through` is required. Sequelize would previously attempt to autogenerate names but that would not always lead to the most logical setups.

This will add methods `getUsers`, `setUsers`, `addUsers` to `Project`, and `getProjects`, `setProjects` and `addProject` to `User`.

Sometimes you may want to rename your models when using them in associations. Let's define users as workers and projects as tasks by using the alias (`as`) option:
```js  
User.belongsToMany(Project, { as: 'Tasks', through: 'worker_tasks' })
Project.belongsToMany(User, { as: 'Workers', through: 'worker_tasks' })
```

Of course you can also define self references with belongsToMany:
    
```js
Person.belongsToMany(Person, { as: 'Children', through: 'PersonChildren' })
// This will create the table PersonChildren which stores the ids of the objects.

```
If you want additional attributes in your join table, you can define a model for the join table in sequelize, before you define the association, and then tell sequelize that it should use that model for joining, instead of creating a new one:

```js
User = sequelize.define('User', {})
Project = sequelize.define('Project', {})
UserProjects = sequelize.define('UserProjects', {
    status: DataTypes.STRING
})
 
User.belongsToMany(Project, { through: UserProjects })
Project.belongsToMany(User, { through: UserProjects })
```

To add a new project to a user and set it's status, you pass an extra object to the setter, which contains the attributes for the join table
    
```js
user.addProject(project, { status: 'started' })
```

By default the code above will add ProjectId and UserId to the UserProjects table, and _remove any previously defined primary key attribute_ - the table will be uniquely identified by the combination of the keys of the two tables, and there is no reason to have other PK columns. To enforce a primary key on the `UserProjects` model you can add it manually.
    
```js
UserProjects = sequelize.define('UserProjects', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    status: DataTypes.STRING
})
```

## Scopes
This section concerns association scopes. For a definition of assocation scopes vs. scopes on associated models, see [Scopes](docs/scopes).

Association scopes allow you to place a scope (a set of default attributes for `get` and `create`) on the association. Scopes can be placed both on the associated model (the target of the association), and on the through table for n:m relations.

#### 1:m
Assume we have tables Comment, Post and Image. A comment can be associated to either an image or a post via `commentable_id` and `commentable` - we say that Post and Image are `Commentable`

```js
this.Comment = this.sequelize.define('comment', {
  title: Sequelize.STRING,
  commentable: Sequelize.STRING,
  commentable_id: Sequelize.INTEGER
}, {
  instanceMethods: {
    getItem: function() {
      return this['get' + this.get('commentable').substr(0, 1).toUpperCase() + this.get('commentable').substr(1)]();
    }
  }
});

this.Post.hasMany(this.Comment, {
  foreignKey: 'commentable_id',
  constraints: false,
  scope: {
    commentable: 'post'
  }
});
this.Comment.belongsTo(this.Post, {
  foreignKey: 'commentable_id',
  constraints: false,
  as: 'post'
});

this.Image.hasMany(this.Comment, {
  foreignKey: 'commentable_id',
  constraints: false,
  scope: {
    commentable: 'image'
  }
});
this.Comment.belongsTo(this.Image, {
  foreignKey: 'commentable_id',
  constraints: false,
  as: 'image'
});
```

`constraints: false,` disables references constraints - since the `commentable_id` column references several tables, we cannot add a `REFERENCES` constraint to it. Note that the Image -> Comment and Post -> Comment relations define a scope, `commentable: 'image'` and `commentable: 'post'` respectively. This scope is automatically applied when using the association functions:

```js
image.getComments()
SELECT * FROM comments WHERE commentable_id = 42 AND commentable = 'image';

image.createComment({
  title: 'Awesome!'
})
INSERT INTO comments (title, commentable_id, commentable) VALUES ('Awesome!', 'image', 42);

image.addComment(comment);
UPDATE comments SET commentable_id = 42, commentable = 'image'
```

The `getItem` utility function on `Comment` completes the picture - it simply converts the `commentable` string into a call to etiher `getImage` or `getPost`, providing an abstraction over whether a comment belongs to a post or an image.

#### n:m
Continuing with the idea of a polymorphic model, consider a tag table - an item can have multiple tags, and a tag can be related to several item

For brevity, the example only shows a Post model, but in reality Tag would be related to several other models.

```js
ItemTag = sequelize.define('item_tag', {
  tag_id: {
    type: DataTypes.INTEGER,
    unique: 'item_tag_taggable'
  },
  taggable: {
    type: DataTypes.STRING,
    unique: 'item_tag_taggable'
  },
  taggable_id: {
    type: DataTypes.INTEGER,
    unique: 'item_tag_taggable',
    references: null
  }
});
Tag = sequelize.define('tag', {
  name: DataTypes.STRING
});

Post.belongsToMany(Tag, {
  through: {
    model: ItemTag,
    unique: false,
    scope: {
      taggable: 'post'
    }
  },
  foreignKey: 'taggable_id',
  constraints: false
});
Tag.belongsToMany(Post, {
  through: {
    model: ItemTag,
    unique: false
  },
  foreignKey: 'tag_id'
});
```

Notice that the scoped column (`taggable`) is now on the through model (`ItemTag`).

We could also define a more restrictive association, for example to get all pending tags for a post by applying a scope of both the through model (`ItemTag`) and the target model (`Tag`):

```js
Post.hasMany(Tag, {
  through: {
    model: ItemTag,
    unique: false,
    scope: {
      taggable: 'post'
    }
  },
  scope: {
    status: 'pending'
  },
  as: 'pendingTags',
  foreignKey: 'taggable_id',
  constraints: false
});

Post.getPendingTags();
```
```sql
SELECT `tag`.*  INNER JOIN `item_tags` AS `item_tag` 
ON `tag`.`id` = `item_tag`.`tagId` 
  AND `item_tag`.`taggable_id` = 42
  AND `item_tag`.`taggable` = 'post'
WHERE (`tag`.`status` = 'pending');
```

`constraints: false` disables references constraints on the `taggable_id` column. Because the column is polymorphic, we cannot say that it `REFERENCES` a specific table.

## Naming strategy

By default sequelize will use the model name (the name passed to `sequelize.define`) to figure out the name of the model when used in associations. For example, a model named `user` will add the functions `get/set/add User` to instances of the associated model, and a property named `.user` in eager loading, while a model named `User` will add the same functions, but a property named `.User` (notice the upper case U) in eager loading.

As we've already seen, you can alias models in associations using `as`. In single associations (has one and belongs to), the alias should be singular, while for many associations (has many) it should be plural. Sequelize then uses the [inflection ][0]library to convert the alias to its singular form. However, this might not always work for irregular or non-english words. In this case, you can provide both the plural and the singular form of the alias:

```js
User.belongsToMany(Project, { as: { singular: 'task', plural: 'tasks' }})
// Notice that inflection has no problem singularizing tasks, this is just for illustrative purposes.
```

If you know that a model will always use the same alias in associations, you can provide it when creating the model
    
```js
var Project = sequelize.define('project', attributes, {
  name: {
    singular: 'task',
    plural: 'tasks',
  }
})
 
User.belongsToMany(Project);
```

This will add the functions `add/set/get Tasks` to user instances.

## Associating objects

Because Sequelize is doing a lot of magic, you have to call `Sequelize.sync` after setting the associations! Doing so will allow you the following:
    
```js
Project.belongsToMany(Task)
Task.belongsToMany(Project)
 
Project.create()...
Task.create()...
Task.create()...
 
// save them... and then:
project.setTasks([task1, task2]).then(function() {
  // saved!
})
 
// ok now they are save... how do I get them later on?
project.getTasks().then(function(associatedTasks) {
  // associatedTasks is an array of tasks
})
 
// You can also pass filters to the getter method.
// They are equal to the options you can pass to a usual finder method.
project.getTasks({ where: 'id > 10' }).then(function(tasks) {
  // tasks with an id greater than 10 :)
})
 
// You can also only retrieve certain fields of a associated object.
// This example will retrieve the attributes "title" and "id"
project.getTasks({attributes: ['title']}).then(function(tasks) {
  // tasks with an id greater than 10 :)
})
```

To remove created associations you can just call the set method without a specific id:
    
```js
// remove the association with task1
project.setTasks([task2]).then(function(associatedTasks) {
  // you will get task2 only
})
 
// remove 'em all
project.setTasks([]).then(function(associatedTasks) {
  // you will get an empty array
})
 
// or remove 'em more directly
project.removeTask(task1).then(function() {
  // it's gone
})
 
// and add 'em again
project.addTask(task1).then(function() {
  // it's back again
})
```

You can of course also do it vice versa:

```js
// project is associated with task1 and task2
task2.setProject(null).then(function() {
  // and it's gone
})
```

For hasOne/belongsTo its basically the same:

```js
Task.hasOne(User, {as: "Author"})
Task#setAuthor(anAuthor)
```

Adding associations to a relation with a custom join table can be done in two ways (continuing with the associations defined in the previous chapter):
    
```js
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
```

When getting data on an association that has a custom join table, the data from the join table will be returned as a DAO instance:

```js
u.getProjects().then(function(projects) {
  var project = projects[0]
 
  if (project.UserProjects.status === 'active') {
    // .. do magic
 
    // since this is a real DAO instance, you can save it directly after you are done doing magic
    return project.UserProjects.save()
  }
})
```

If you only need some of the attributes from the join table, you can provide an array with the attributes you want:
    
```js
// This will select only name from the Projects table, and only status from the UserProjects table
user.getProjects({ attributes: ['name'], joinTableAttributes: ['status']})
```

## Check associations
You can also check if an object is already associated with another one (N:M only). Here is how you'd do it:
    
```js
// check if an object is one of associated ones:
Project.create({ /* */ }).then(function(project) {
  return User.create({ /* */ }).then(function(user) {
    return project.hasUser(user).then(function(result) {
      // result would be false
      return project.addUser(user).then(function() {
        return project.hasUser(user).then(function(result) {
          // result would be true
        })
      })
    })
  })
})
 
// check if all associated objects are as expected:
// let's assume we have already a project and two users
project.setUsers([user1, user2]).then(function() {
  return project.hasUsers([user1]).then(function(result) {
    // result would be false
    return project.hasUsers([user1, user2]).then(function(result) {
      // result would be true
    })
  })
})
```

## Foreign Keys

When you create associations between your models in sequelize, foreign key references with constraints will automatically be created. The setup below:

```js
var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
  , User = this.sequelize.define('User', { username: Sequelize.STRING })
 
User.hasMany(Task)
Task.belongsTo(User)
```

Will generate the following SQL:
    
```sql
CREATE TABLE IF NOT EXISTS `User` (
  `id` INTEGER PRIMARY KEY, 
  `username` VARCHAR(255)
);
 
CREATE TABLE IF NOT EXISTS `Task` (
  `id` INTEGER PRIMARY KEY, 
  `title` VARCHAR(255), 
  `user_id` INTEGER REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);
```

The relation between task and user injects the `user_id` foreign key on tasks, and marks it as a reference to the `User` table. By default `user_id` will be set to `NULL` if the referenced user is deleted, and updated if the id of the user id updated. These options can be overridden by passing `onUpdate` and `onDelete` options to the association calls. The validation options are `RESTRICT, CASCADE, NO ACTION, SET DEFAULT, SET NULL`. 

For 1:1 and 1:m associations the default option is `SET NULL` for deletion, and `CASCADE` for updates. For n:m, the default for both is `CASCADE`. This means, that if you delete or update a row from one side of an n:m association, all the rows in the join table referencing that row will also be deleted or updated.

Adding constraints between tables means that tables must be created in the database in a certain order, when using `sequelize.sync`. If Task has a reference to User, the User table must be created before the Task table can be created. This can sometimes lead to circular references, where sequelize cannot find an order in which to sync. Imagine a scenario of documents and versions. A document can have multiple versions, and for convenience, a document has an reference to it's current version.
    
```js
var Document = this.sequelize.define('Document', {
      author: Sequelize.STRING
    })
  , Version = this.sequelize.define('Version', {
      timestamp: Sequelize.DATE
    })
 
Document.hasMany(Version) // This adds document_id to version
Document.belongsTo(Version, { as: 'Current', foreignKey: 'current_version_id'}) // This adds current_version_id to document
```

However, the code above will result in the following error: `Cyclic dependency found. 'Document' is dependent of itself. Dependency Chain: Document -> Version => Document`. In order to alleviate that, we can pass `constraints: false` to one of the associations:
    
```js
Document.hasMany(Version)
Document.belongsTo(Version, { as: 'Current', foreignKey: 'current_version_id', constraints: false})
```

Which will allow us to sync the tables correctly:
    
```sql
CREATE TABLE IF NOT EXISTS `Document` (
  `id` INTEGER PRIMARY KEY, 
  `author` VARCHAR(255), 
  `current_version_id` INTEGER
);
CREATE TABLE IF NOT EXISTS `Version` (
  `id` INTEGER PRIMARY KEY, 
  `timestamp` DATETIME, 
  `document_id` INTEGER REFERENCES `Document` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);
```

### Enforcing a foreign key reference without constraints

Some times you may want to reference another table, without adding any constraints, or associations. In that case you can manually add the reference attributes to your schema definition, and mark the relations between them.
    
```js
var Series, Trainer, Video
 
// Series has a trainer_id=Trainer.id foreign reference key after we call Trainer.hasMany(series)
Series = sequelize.define('Series', {
  title:        DataTypes.STRING,
  sub_title:    DataTypes.STRING,
  description:  DataTypes.TEXT,
 
  // Set FK relationship (hasMany) with `Trainer`
  trainer_id: {
    type: DataTypes.INTEGER,
    references: "Trainers",
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
```



[0]: https://www.npmjs.org/package/inflection
