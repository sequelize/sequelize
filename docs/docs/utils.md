## Utils

Sequelize comes with some handy utils including references to`lodash`as well as some individual helpers&period; You can access them via`Sequelize&period;Utils`&period;

### Lodash.js

You can access all the methods of lodash like this&colon;
    
    Sequelize.Utils._.each(/* ... */)
    Sequelize.Utils._.map(/* ... */)
    Sequelize.Utils._...

Also Sequelize ships the Underscore extension`underscore&period;string`&comma; which allows nifty string manipulation&colon;
    
    Sequelize.Utils._.camelize('something') // Something

Check out the page of [Lodash][0]&comma; [Underscore][1] and [underscore&period;string][2] for further information&period;

### QueryChainer

Because you will want to save&sol;create&sol;delete several items at once and just go on after all of them are saved&comma; Sequelize provides the`QueryChainer`module&period; It can be used like this&colon;
    
    var chainer = new Sequelize.Utils.QueryChainer
    chainer.add(/* Query | EventEmitter */)
    chainer.run().success(function(){}).error(function(errors){})

And a real world example&colon;
    
    var chainer = new Sequelize.Utils.QueryChainer
    var Task    = sequelize.define('Task', /* ... */)
     
    chainer
      .add(Task.drop())
      .add(Task.sync())
     
    for(var i = 0; i < 20; i++)
      chainer.add(Task.create({}))
     
    chainer
      .run()
      .success(function(){})
      .error(function(errors){})

It is also possible to force a serial run of the query chainer by using the following syntax:
    
    new Sequelize.Utils.QueryChainer()
      .add(Model, 'function', [param1, param2])
      .add(Model, 'function2', [param1, param2])
      .runSerially()
      .success(function() { /* no problems :) */ })
      .error(function(err) { /* hmm not good :> */ })
     
    // and with options:
     
    new Sequelize.Utils.QueryChainer()
      .add(Model, 'function', [param1, param2], {
        // Will be executed before Model#function is called
        before: function(model) {},
     
        /*
          Will be executed after Model#function was called
          and the function emitted a success or error event.
          If the following success option is passed, the function
          will be executed after the success function.
        */
        after: function(migration) {},
     
        // Will be executed if Model#function emits a success event.
        success: function(migration, callback) {}
      })
      // skipOnError: don't execute functions once one has emitted an failure event.
      .runSerially({ skipOnError: true })
      .success(function() { /* no problems :) */ })
      .error(function(err) { /* hmm not good :> */ })

If the success callbacks of the added methods are passing values&comma; they can be utilized in the actual`success`method of the query chainer&colon;
    
    chainer.add(Project.getTasks())
    chainer.add(Project.getTeam())
    chainer.run().success(function(results){
      var tasks = results[0]
      var team = results[1]
    })

### CustomEventEmitter

One of the core components of the library is the `CustomEventEmitter`,
which takes an (asynchronous) function, allows the binding to certain events
and finally runs the passed function. Within the function, the user gets
access to the emitter instance and can (once the function's logic is done)
emit success / error events. The basic look is the following:
    
    new Sequelize.Utils.CustomEventEmitter(function(emitter) {
      doAsyncLogic(function(err) {
        if (err) {
          emitter.emit('error', err)
        } else {
          emitter.emit('success')
        }
      })
    })
    .success(function() { /* success! */ })
    .error(function(err) { /* error */ })
    .run()

As you can probably see, the event observing is the very same
as for all the asynchronous methods in the Sequelize universe.
That's because every asynchronouse function in Sequelize
returns an instance of the CustomEventEmitter.

If you are afraid, that the passed function might have been
executed already just before you bound the event observers:
The execution of the function is delayed minimally.
Because of that you can also just call `.run()`
and bind the events afterwards.

Because there is a fair chance, that you already have an emitter
and you just want to pipe the events from one emitter to the other,
each instance has a method called `.proxy()`:
    
    new Sequelize.Utils.CustomEventEmitter(function(emitter) {
      asyncAuthLogic(function(err) {
        if (err) {
          return emitter.emit('err')
        }
     
        Model
          .find()
          .proxy(emitter, { events: ['error'] })
          .success(function(result) {
            emitter.emit('success', parseInt(result.stringifiedAge, 10))
          })
      })
    })
    .error(function(err) { console.log(err) })
    .success(function(ageAsInteger) { console.log(ageAsInteger) })
    .run()

In this example we first do an asynchronous authentication check,
receive an instance from the database afterwards and finally
transform its data. As we aren't interested in a special treatment
for the different error case, we will just observe the error event
once and pipe the error cases of the `Model.find()` call
to the outer emitter.

[0]: http://lodash.com/
[1]: http://underscorejs.org/
[2]: https://github.com/epeli/underscore.string
