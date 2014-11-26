## Hooks

Hooks (also known as callbacks or lifecycle events), are functions which are called before and after calls in sequelize are executed. For example, if you want to always set a value on a model before saving it, you can add a`beforeUpdate`hook.

### Order of Operations
    
    (1) 
      beforeBulkCreate(daos, fields, fn) 
      beforeBulkDestroy(daos, fields, fn) 
      beforeBulkUpdate(daos, fields, fn)
    (2) 
      beforeValidate(dao, fn)
    (-)
      validate
    (3) 
      afterValidate(dao, fn)
    (4) 
      beforeCreate(dao, fn)
      beforeDestroy(dao, fn)
      beforeUpdate(dao, fn)
    (-) 
      create 
      destroy 
      update
    (5) 
      afterCreate(dao, fn) 
      afterDestroy(dao, fn)
      afterUpdate(dao, fn) 
    (6) 
      afterBulkCreate(daos, fields, fn) 
      afterBulkDestory(daos, fields, fn) 
      afterBulkUpdate(daos, fields, fn)

### Declaring Hooks

There are currently three ways to programmatically add hooks. A hook function always runs asynchronousĺy, and can be resolved either by calling a callback (passed as the last argument),
or by returning a promise.
    
    // Method 1 via the .define() method
    var User = sequelize.define('User', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    }, {
      hooks: {
        beforeValidate: function(user, fn) {
          user.mood = 'happy'
          fn(null, user)
        },
        afterValidate: function(user, fn) {
          user.username = 'Toni'
          fn(null, user)
        }
      }
    })
     
    // Method 2 via the .hook() method
    var User = sequelize.define('User', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    })
     
    User.hook('beforeValidate', function(user, fn) {
      user.mood = 'happy'
      fn(null, user)
    })
     
    User.hook('afterValidate', function(user) {
      return sequelize.Promise.reject("I'm afraid I can't let you do that!")
    })
     
    // Method 3 via the direct method
    var User = sequelize.define('User', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    })
     
    User.beforeValidate(function(user) {
      user.mood = 'happy'
      return sequelize.Promise.resolve(user)
    })
     
    User.afterValidate(function(user, fn) {
      user.username = 'Toni'
      fn(null, user)
    })

#### Instance hooks

The following hooks will emit whenever you're editing a single object...
    
    beforeValidate
    afterValidate
    beforeCreate / beforeUpdate  / beforeDestroy
    afterCreate / afterUpdate / afterDestroy

    // ...define ...
    User.beforeCreate(function(user, fn) {
      if (user.accessLevel > 10 && user.username !== "Boss") {
        return fn("You can't grant this user an access level above 10!")
     }
     return fn()
    })

This example will emit an error:
    
    User.create({username: 'Not a Boss', accessLevel: 20}).error(function(err) {
      console.log(err) // You can't grant this user an access level above 10!
    })

The following example would emit a success event:
    
    User.create({username: 'Boss', accessLevel: 20}).success(function(user) {
      console.log(user) // user object with username as Boss and accessLevel of 20
    })

#### Model hooks

Sometimes you'll be editing more than one record at a time by utilizing the`bulkCreate, update, destroy`methods on the model. The following will emit whenever you're using one of those methods.
    
    beforeBulkCreate / beforeBulkUpdate / beforeBulkDestroy
    afterBulkCreate / afterBulkUpdate / afterBulkDestroy

If you want to emit hooks for each individual record, along with the bulk hooks you can pass`individualHooks: true`to the call.
    
    Model.destroy({accessLevel: 0}, {individualHooks: true}) 
    // Will select all records that are about to be deleted and emit before- + after- Destroy on each instance
     
    Model.update({username: 'Toni'}, {accessLevel: 0}, {individualHooks: true})
    // Will select all records that are about to be updated and emit before- + after- Update on each instance
     
    Model.bulkCreate({accessLevel: 0}, null, {individualHooks: true}) 
    // Will select all records that are about to be deleted and emit before- + after- Create on each instance

Some model hooks have two or three parameters sent to each hook depending on it's type.
    
    Model.beforeBulkCreate(function(records, fields, fn) {
      // records = the first argument sent to .bulkCreate
      // fields = the second argument sent to .bulkCreate
    })
     
    Model.bulkCreate([
      {username: 'Toni'}, // part of records argument
      {username: 'Tobi'} // part of records argument
    ], ['username'] /* part of fields argument */)
     
    Model.beforeBulkUpdate(function(attributes, where, fn) {
      // attributes = first argument sent to Model.update
      // where = second argument sent to Model.update
    })
     
    Model.update({gender: 'Male'} /*attributes argument*/, {username: 'Tom'} /*where argument*/)
     
    Model.beforeBulkDestroy(function(whereClause, fn) {
      // whereClause = first argument sent to Model.destroy
    })
     
    Model.destroy({username: 'Tom'} /*whereClause argument*/)

## Associations

For the most part hooks will work the same for instances when being associated except a few things

1. When using add/set\[s\] functions the beforeUpdate/afterUpdate hooks will run.
2. The only way to call beforeDestroy/afterDestroy hooks are on associations with`onDelete: 'cascade'`and the option`hooks: true`. For instance:
    
    var Projects = sequelize.define('Projects', {
      title: DataTypes.STRING
    })
     
    var Tasks = sequelize.define('Tasks', {
      title: DataTypes.STRING
    })
     
    Projects.hasMany(Tasks, {onDelete: 'cascade', hooks: true})
    Tasks.belongsTo(Projects)

This code will run beforeDestroy/afterDestroy on the Tasks table. Sequelize, by default, will try to optimize your queries as much as possible. 
When calling cascade on delete, Sequelize will simply execute a 
    
    DELETE FROM `table` WHERE associatedIdentifiier = associatedIdentifier.primaryKey

However, adding`hooks: true`explicitly tells Sequelize that optimization is not of your concern and will perform a`SELECT`on the associated objects and destroy each instance one by one in order to be able to call the hooks with the right parameters.
