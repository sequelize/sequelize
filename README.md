# Sequelize #

The Sequelize library provides easy access to MySQL, SQLite or PostgreSQL databases by mapping database entries to objects and vice versa. To put it in a nutshell... it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## Blogposts/Changes ##
- [v1.4.1](http://blog.sequelizejs.com/post/24403298792/changes-in-sequelize-1-4-1): deprecation of node < 0.6, logging customization, ...
- [v1.4.0](http://blog.sequelizejs.com/post/24345409723/changes-in-sequelize-1-4-0): postgresql, connection pooling, ...
- [v1.3.0](http://blog.depold.com/post/15283366633/changes-in-sequelize-1-3-0): migrations, cross-database, validations, new listener notation, ...
- [v1.2.1](http://blog.depold.com/post/12319530694/changes-in-sequelize-1-2-1): changes some defaults and some interfaces
- [v1.0.0](http://blog.depold.com/post/5936116582/changes-in-sequelize-1-0-0): complete rewrite

## Features ##

- Schema definition
- Schema synchronization/dropping
- Easy definition of class/instance methods
- Instance saving/updating/dropping
- Asynchronous library
- Associations
- Importing definitions from single files

## Documentation, Examples and Updates ##

You can find the documentation and announcements of updates on the [project's website](http://www.sequelizejs.com).
If you want to know about latest development and releases, follow me on [Twitter](http://twitter.com/sdepold).
Also make sure to take a look at the examples in the repository. The website will contain them soon, as well.

- [Documentation](http://www.sequelizejs.com)
- [Twitter](http://twitter.com/sdepold)
- [IRC](irc://irc.freenode.net/sequelizejs)
- [XING](https://www.xing.com/net/priec1b5cx/sequelize)

## Collaboration ##

I'm glad to get pull request if any functionality is missing or something is buggy. But _please_ ... run the tests before you send me the pull request.

Now if you want to contribute but don't really know where to begin
don't worry, the steps below will guide you to have a sequelize
contributor's environment running in a couple minutes.

### 1. Prepare the environment ###

All the following steps consider you already have [npm](http://npmjs.org/) installed in your [node.js version 0.4.6 or higher](https://github.com/sdepold/sequelize/blob/master/package.json#L30)

#### 1.1 MySQL and other external dependencies ####

Contributing to sequelize requires you to have
[MySQL](http://www.mysql.com/) up and running in your local
environment. The reason for that is that we have test cases that runs
against an actual MySQL server and make sure everything is always
working. 

That is also one of the reasons your features must come with tests:
let's make sure sequelize will stay awesome as more features are added
as well as that fixed bugs will never come back.

Well, after installing **MySQL** you also need to create the sequelize test database:

```console
$ echo "CREATE DATABASE sequelize_test;" | mysql -uroot
```

**CLEVER NOTE:** your local MySQL install must be with username `root`
  without password. If you want to customize that just hack in the
  tests, but make sure to don't commit your credentials, we don't want
  to expose your personal data in sequelize codebase ;)

**AND ONE LAST THING:** Sequelize also supports SQLite. So this should be working
on your machine as well :)

### 2. Install the dependencies ###

Just "cd" into sequelize directory and run `npm install`, see an example below:

```console
$ cd path/to/sequelize
$ npm install
```

### 3. Run the tests ###

In order to run the tests you got to run `jasmine-node` against the `spec` directory.
By the way, [there](https://github.com/sdepold/sequelize/tree/master/spec) is where
you will write new tests if that's the case.

All you need is to run `./node_modules/.bin/jasmine-node spec/`,
although this is kinda long and boring, so we configures a NPM task
and made that less laborious to you :)

```console
$ npm test
```

### 4. That's all ###

Just commit and send pull requests.

Happy hacking and thank you for contributing

# Build status

The automated tests we talk about just so much are running on
[Travis public CI](http://travis-ci.org), here is its status:

[![Build Status](https://secure.travis-ci.org/sdepold/sequelize.png)](http://travis-ci.org/sdepold/sequelize)
