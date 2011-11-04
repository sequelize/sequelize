# Sequelize #

The Sequelize library provides easy access to a MySQL database by mapping database entries to objects and vice versa. To put it in a nutshell... it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## v1.2.1 ##
I highly recommend to [read this article about the changes in sequelize 1.2.1](http://blog.depold.com/post/12319530694/changes-in-sequelize-1-2-1), which changes some defaults and some interfaces.

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
For a (more or less) complete overview of changes in 1.0.0. take a look at [this blogpost](http://blog.depold.com/post/5936116582/changes-in-sequelize-1-0-0).
An article about changes in 1.2.1. can be found [here](http://blog.depold.com/post/12319530694/changes-in-sequelize-1-2-1)

## Collaboration ##

I'm glad to get pull request if any functionality is missing or something is buggy. But _please_ ... run the tests before you send me the pull request.

## Tests ##

In order to run the tests, just do ```npm install```, which will install expresso and jasmine. I am switching from
expresso to jasmine, so please add according tests to your pull requests. This is how you start the tests:

    node_modules/.bin/expresso -s test/**/*
    node_modules/.bin/jasmine-node spec/

Current build status on travis-ci: [![Build Status](https://secure.travis-ci.org/sdepold/sequelize.png)](http://travis-ci.org/sdepold/sequelize)
