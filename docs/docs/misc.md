## Utils / Lodash.js
Sequelize comes with some handy utils including references to `lodash` as well as some individual helpers&period; You can access them via `Sequelize.Utils`&period;


You can access all the methods of lodash like this&colon;
   
```js 
Sequelize.Utils._.each(/* ... */)
Sequelize.Utils._.map(/* ... */)
Sequelize.Utils._...
```

Check out the [Lodash][0] page for further information&period;

[0]: http://lodash.com/


## Compatibility

Sequelize is compatible to the following versions of Node.JS:

* 0.8.x
* 0.10.x

## Asynchronicity

Since`v1&period;3&period;0`there are multiple ways of adding listeners to asynchronous requests&period; First of all&comma; each time you call a finder method or save an object&comma; sequelize triggers asynchronous logic&period; To react to the success or the failure &lpar;or both&rpar; of the request&comma; you can do the following&colon;
    
    // the old, pre-v1.3.0 way
    Model.findAll().on('success', function(models) { /* foo */ })
    Model.findAll().on('failure', function(err) { /* bar */ })
     
    // the new, >=v1.3.0 way
    // each one is valid
    Model.findAll().on('success', function(models) { /* foo */ })
    Model.findAll().success(function(models) { /* foo */ })
    Model.findAll().ok(function(models) { /* foo */ })
     
    // Model.findAll().on('failure', function(err) { /* bar */ }) ==> invalid since v1.5.0
    Model.findAll().on('error', function(err) { /* bar */ }) //   ==> new since v1.5.0
    Model.findAll().error(function(err) { /* bar */ })
    Model.findAll().failure(function(err) { /* bar */ })
    Model.findAll().fail(function(err) { /* bar */ })
     
    Model.findAll().complete(function(err, result) { /* bar */ })
    Model.findAll().done(function(err, result) { /* bar */ })
     
    // As of 1.7.0 we support Promises/A
    var self = User
     
    user.find(1).then(function(user1) {
      return user1.increment(['aNumber'], 2)
    }).then(function(user2) {
      return user.find(1)
    }).then(function(user3) {
      console.log(user3.aNumber) // 2
    }, function(err) {
      // err...
    })
     
     
    // For functions with multiple success values (e.g. findOrCreate) there is also spread
     
    user.findOrCreate(...).spread(function(user, wasCreated) {
      // all arguments are passed
    })
    user.findOrCreate(...).then(function(user) {
      // only the first argument is passed
    })

**Please notice&colon;**Since v1&period;5&period;0 the 'error' event is used to notify about errors&period; If such events aren't caught however&comma; Node&period;JS will throw an error&period; So you would probably like to catch them &colon;D

### Additional links

If you want to keep track about latest development of sequelize or to just discuss things with other sequelize users you might want to take a look at the following resources&colon;

* [Twitter&colon; &commat;sdepold][0]
* [Twitter&colon; &commat;sequelizejs][1]
* [ADN&colon; &commat;sdepold][2]
* [IRC&colon; sequelizejs&commat;freenode&period;net][3]
* [XING][4]
* [Facebook][5]

## Companies & Projects

Here is a list of companies and projects that are using Sequelize in real world applications&colon;

### [Shutterstock][6]

Shutterstock Images LLC is a leading global provider of high-quality stock footage&comma; stock photography&comma; vectors and illustrations to creative industry professionals around the world&period; Shutterstock works closely with its growing contributor community of artists&comma; photographers&comma; videographers and illustrators to curate a global marketplace for royalty-free&comma; top-quality imagery&period; Shutterstock adds tens of thousands of rights-cleared images and footage clips each week&comma; with more than 18 million files currently available&period;

### [Clevertech][7]

Clevertech builds web and mobile applications for startups using Lean and Agile methodologies. Clevertech relies on Sequelize for its applications, its speed, versatility and data flexibility. Clevertech contributes back to open source development and its expert developers support the continuing effort to make sequelize the best ORM for Node projects.

### [Metamarkets][8]

Metamarkets enables buyers and sellers of digital media to visualize insights and make decisions with real-time pricing&comma; performance&comma; and audience data&period;

### [filsh][10]

filsh allows you to download online videos from various video
portals like YouTube, Vimeo and Dailymotion in a format you like.
No software required.

### [Using sequelize&quest;][11]

If you want to get listed here&comma; just drop me a line or send me a pull-request on Github&excl;

  
  


[0]: http://twitter.com/sdepold
[1]: http://twitter.com/sequelizejs
[2]: https://alpha.app.net/sdepold
[3]: irc://irc.freenode.net/sequelizejs
[4]: https://www.xing.com/net/priec1b5cx/sequelize
[5]: https://www.facebook.com/sequelize
[6]: http://www.shutterstock.com
[7]: http://www.clevertech.biz
[8]: http://metamarkets.com/
[9]: https://innofluence.com
[10]: http://filsh.net
[11]: https://github.com/sequelize/sequelize/tree/gh-pages