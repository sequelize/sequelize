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

## Collaboration 2.0 ##

I'm glad to get pull request if any functionality is missing or something is buggy. But _please_ ... run the tests before you send me the pull request.

Still interested? Coolio! Here is how to get started:

### 1. Prepare your environment ###

Here comes a little surprise: You need [Node.JS](http://nodejs.org). In order to be
a productive developer, I would recommend the latest v0.8 (or a stable 0.9 if
already out). Also I usually recommend [NVM](https://github.com/creationix/nvm).

Once Node.JS is installed on your computer, you will also have access to the lovely
Node Package Manager (NPM).

### 2. Database... Come to me! ###

First class citizen of Sequelize was MySQL. Over time, Sequelize began to
become compatible to SQLite and PostgreSQL. In order to provide a fully
featured pull request, you would most likely want to install of them. Give
it a try, it's not that hard.

If you are too lazy or just don't know how to get this work,
feel free to join the IRC channel (freenode@#sequelizejs).

For MySQL and PostgreSQL you'll need to create a DB called `sequelize_test`.
For MySQL this would look like this:

```console
$ echo "CREATE DATABASE sequelize_test;" | mysql -uroot
```

**CLEVER NOTE:** your local MySQL install must be with username `root`
  without password. If you want to customize that just hack in the
  tests, but make sure to don't commit your credentials, we don't want
  to expose your personal data in sequelize codebase ;)

**AND ONE LAST THING:** Once `npm install` worked for you (see below), you'll
get SQLite tests for free :)


### 3. Install the dependencies ###

Just "cd" into sequelize directory and run `npm install`, see an example below:

```console
$ cd path/to/sequelize
$ npm install
```

### 4. Run the tests ###

Right now, the test base is split into the `spec` folder (which contains the
lovely [BusterJS](http://busterjs.org) tests) and the `spec-jasmine` folder
(which contains the ugly and awkward node-jasmine based tests). A main goal
is to get rid of the jasmine tests!

As you might haven't installed all of the supported SQL dialects, here is how
to run the test suites for your development environment:

```console
$ # run all tests at once:
$ npm test

$ # run only the jasmine tests (for all dialects):
$ npm run test-jasmine

$ # run all of the buster specs (for all dialects):
$ npm run test-buster

$ # run the buster specs for mysql:
$ npm run test-buster-mysql

$ # run the buster specs for sqlite:
$ npm run test-buster-sqlite

$ # run the buster specs for postgresql:
$ npm run test-buster-postgres
```

### 5. That's all ###

Just commit and send pull requests.
Happy hacking and thank you for contributing.
Ah and one last thing: If you think you deserve it, feel free to add yourself to the
`package.json`. Also I always look for projects which are using sequelize. If you have
one of them, drop me a line!


# Build status

The automated tests we talk about just so much are running on
[Travis public CI](http://travis-ci.org), here is its status:

[![Build Status](https://secure.travis-ci.org/sdepold/sequelize.png)](http://travis-ci.org/sdepold/sequelize)
