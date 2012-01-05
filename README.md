# Sequelize #

The Sequelize library provides easy access to a MySQL database by mapping database entries to objects and vice versa. To put it in a nutshell... it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## Blogposts/Changes ##
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

## Collaboration ##

I'm glad to get pull request if any functionality is missing or something is buggy. But _please_ ... run the tests before you send me the pull request.

## Tests ##

In order to run the tests, just do ```npm install```, which will install jasmine. Please add tests to your pull requests. This is how you start the tests:

    node_modules/.bin/jasmine-node spec/

Current build status on travis-ci: [![Build Status](https://secure.travis-ci.org/sdepold/sequelize.png)](http://travis-ci.org/sdepold/sequelize)
