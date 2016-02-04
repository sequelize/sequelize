## Introduction

This section covers the use of Sequelize on Heroku. It will explain how to get started with Heroku and what is necessary to setup a proper environment. We will use MySQL on the development machine and PostgreSQL on the remote servers.

## Getting started with Heroku

Before we can roll out any software on the Heroku cluster, we need to sign up and have to connect our development environment. Here are the most basic steps:

* [Sign up][0] for a Heroku account.
* [Install][1] the Heroku Toolbelt. This tool will let you create applications and is a handy way to configure them on the command line.
* Use the new binary to login. Run the following command on command line:`heroku login`

And that's it. You should now be able to do things like `heroku apps`. This should list all applications you've currently created on the Heroku cluster. If you've just created a new account, this should show you an empty list. [You can get further information about the registration process here][2].

## A minimal express application

In order to create a minimal express application, we need to install express first. We can do this via the following commands:

```bash    
$ mkdir example-app
$ cd example-app
$ npm install express
$ node_modules/.bin/express . -f
$ npm install
$ node app.js
```

So now we have a default express application. If you point your browser to `http://localhost:8080`, you will see a tiny page welcoming you.

Next step: Deploy the application to Heroku.

## Deployment to Heroku

First of all, we need to add the right version of Node.JS and NPM to the `package.json`. The file should look similar to this:
    
```js
{
  "name": "application-name",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "3.1.1",
    "jade": "*"
  },
  "engines": {
    "node": "0.8.x",
    "npm": "1.1.x"
  }
}
```

Now we can create a Heroku application and deploy to it:
    
```bash
$ echo "web: node app.js" > Procfile
$ echo "node_modules" > .gitignore
$ git init
$ git add .
$ git commit -m "initial commit"
$ heroku create
$ git push heroku master
$ heroku ps:scale web=1
$ heroku open
```

You should now see a browser with the same application as on your local machine.

## Spawning a database on Heroku

In order to get a database on Heroku we can use their CLI. Just run the following command and take a closer look at it's output:
    
```bash
$ heroku addons:add heroku-postgresql:dev
```

This will result in something like this:
    
```bash
Adding heroku-postgresql:dev on fast-dusk-7858... done, v5 (free)
Attached as HEROKU_POSTGRESQL_BRONZE_URL
Database has been created and is available
 ! This database is empty. If upgrading, you can transfer
 ! data from another database with pgbackups:restore.
Use `heroku addons:docs heroku-postgresql:dev` to view documentation.
```

What we will need is the color (sounds strange right?) of the database. In this case we just created a `bronze` one. That means, that we will have an environment variable `HEROKU_POSTGRESQL_BRONZE_URL` containing the URI of the database.

If you are interested in the URI, you can just run this command:
    
```bash
$ heroku config:get HEROKU_POSTGRESQL_BRONZE_URL
$ # => postgres://pfforbjhkrletg:aic5oO6Cran1g3hk6mJa5QqNZB@ec2-23-21-91-97.compute-1.amazonaws.com:5432/dek11b2j1g3mfb
```

## Adding Sequelize to the application

The following commands will install `sequelize`, the needed PostgreSQL library as well as the MySQL bindings. Also we will create a folder `models`, that will contain the model definitions.
    
```bash
$ npm install --save sequelize pg mysql
$ mkdir models
```

### app.js

In order to create a maintainable application, we will put all the database logic into the `models` folder. The application's main file will then just sync the models with the database and run the server. This way we don't clutter the application.
    
```js
var express = require('express')
  , routes  = require('./routes')
  , user    = require('./routes/user')
  , http    = require('http')
  , path    = require('path')
  , db      = require('./models');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

db.sequelize.sync().then(function() {
  http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
  });
});
```

### models/index.js

The idea of this file is to configure a connection to the database and to collect all model definitions. Once everything is in place we will store the stuff in a singleton. This will make it possible to load the file whenever we need database access without running into issues with duplicated database access.

This file will also differ between the local machine and the Heroku server.
    
```js
if (!global.hasOwnProperty('db')) {
  var Sequelize = require('sequelize')
    , sequelize = null

  if (process.env.HEROKU_POSTGRESQL_BRONZE_URL) {
    // the application is executed on Heroku ... use the postgres database
    sequelize = new Sequelize(process.env.HEROKU_POSTGRESQL_BRONZE_URL, {
      dialect:  'postgres',
      protocol: 'postgres',
      port:     match[4],
      host:     match[3],
      logging:  true //false
    })
  } else {
    // the application is executed on the local machine ... use mysql
    sequelize = new Sequelize('example-app-db', 'root', null)
  }

  global.db = {
    Sequelize: Sequelize,
    sequelize: sequelize,
    User:      sequelize.import(__dirname + '/user') 
    // add your other models here
  }

  /*
    Associations can be defined here. E.g. like this:
    global.db.User.hasMany(global.db.SomethingElse)
  */
}

module.exports = global.db
```

### models/user.js

All the other models of our application will be located as separate files in the `models` folder. We will use the `import`-method of Sequelize to load those files.
    
```js
module.exports = function(sequelize, DataTypes) {
  return sequelize.define("User", {
    username: DataTypes.STRING
  })
}
```

## Running Migrations

To run migrations on Heroku you must have the following entry in your config/config.json file:
    
```js
"production": {
  "use_env_variable": "DATABASE_URL"
}
```

Which also means you must make sure your Heroku environment has [a promoted database.][3] Then from the command line run

```bash
$ heroku run bash
$ sequelize -m
```

## tl;dr

This article explains a straight-forward but maintainable approach for hosting an express application on Heroku. If you don't want to read all the stuff mentioned, just execute the following stuff and have fun.
    
```bash
$ mkdir example-app
$ cd example-app
$ npm install express
$ node_modules/.bin/express . -f
$ npm install
$ curl -s https://gist.github.com/sdepold/ced7d2a4a847f38901ef/raw/459c923dd0a14841c932bb95ff3be8a8170bd563/package.json > package.json
$ echo "web: node app.js" > Procfile
$ echo "node_modules" > .gitignore
$ npm install --save sequelize pg mysql
$ mkdir models
$ git init
$ git add .
$ git commit -m "initial commit"
$ heroku create
$ git push heroku master
$ heroku ps:scale web=1
$ heroku addons:add heroku-postgresql:dev
$ curl -s https://gist.github.com/sdepold/ced7d2a4a847f38901ef/raw/6db41e130a8b901cd0843bf52390b7cb11db5f15/app.js > app.js
$ curl -s https://gist.github.com/sdepold/ced7d2a4a847f38901ef/raw/26c5a94d74db4a242464b02aa8e0ae4b3bac6880/models-index.js > models/index.js
$ curl -s https://gist.github.com/sdepold/ced7d2a4a847f38901ef/raw/3b37b0e5d459b2e4b3833a63a018b600a1001795/models-user.js > models/user.js
$ clear

$ # Now run the following command and change HEROKU_POSTGRESQL_BRONZE_URL in
$ # the file "models/index.js" to its result:
$ heroku config|grep HEROKU_POSTGRESQL|cut -d : -f 1

$ git add .
$ git commit -m "sequelize application"
$ git push heroku master
$ heroku open
```



[0]: https://api.heroku.com/signup/devcenter
[1]: https://toolbelt.heroku.com/
[2]: https://devcenter.heroku.com/articles/quickstart
[3]: https://devcenter.heroku.com/articles/heroku-postgresql#establish-primary-db