# Sequelize [![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/sequelize/sequelize/trend.png)](https://bitdeli.com/free "Bitdeli Badge") [![Build Status](https://secure.travis-ci.org/sequelize/sequelize.png)](http://travis-ci.org/sequelize/sequelize) [![Dependency Status](https://david-dm.org/sequelize/sequelize.png)](https://david-dm.org/sequelize/sequelize) [![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1259407/Sequelize) #

MySQL, MariaDB, PostgresSQL, and SQLite Object Relational Mapper (ORM) for [node](http://nodejs.org).

### Install

To install 1.x.x (currently 1.7.x) - which has a stable API and is mostly backwards compatible:

`npm install sequelize`

To install 2.x.x branch - which has a unstable API and will break backwards compatability:

`npm install sequelize@unstable`

### Resources

- [Getting Started](http://sequelizejs.com/articles/getting-started)
- [Documentation](http://sequelizejs.com/docs)
- [API Reference](https://github.com/sequelize/sequelize/wiki/API-Reference) *Work in progress*
- [Changelog](https://github.com/sequelize/sequelize/blob/master/changelog.md)
- [Collaboration and pull requests](https://github.com/sequelize/sequelize/wiki/Collaboration)
- [Roadmap](https://github.com/sequelize/sequelize/wiki/Roadmap)
- [Meetups](https://github.com/sequelize/sequelize/wiki/Meetups)

## Important Notes ##

### 2.0.0 ###

There is a parallel "branch" of the project, released as `2.0.0-alphaX` in NPM. All those releases are based on the master
and will get all the changes of the master. However, `2.0.0` will contain major backwards compatibility breaking changes. Check the
changelog of the branch: https://github.com/sequelize/sequelize/blob/milestones/2.0.0/changelog.md

##### 2.0.0 API should be considered unstable

### 1.6.0 ###

- We changed the way timestamps are handled. From v1.6.0 on timestamps are stored and loaded as UTC.
- Support for synchronous migrations has been dropped. `up` and `down` methods in migrations do have a third parameter which is the callback parameter. Pass an error or an error message as first parameter to the callback if something went wrong in the migration.

## Blogposts/Changes ##
- [v1.6.0](http://blog.sequelizejs.com/post/46949108134/v1-6-0-eager-loading-support-for-enums-decimals-and) Eager loading, support for enums, decimals and bigint, performance improvements …
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
- Promises
- Hooks/callbacks/lifecycle events

## Documentation and Updates ##

You can find the documentation and announcements of updates on the [project's website](http://sequelizejs.com).
If you want to know about latest development and releases, follow me on [Twitter](http://twitter.com/sdepold).
Also make sure to take a look at the examples in the repository. The website will contain them soon, as well.

- [Documentation](http://sequelizejs.com)
- [Twitter](http://twitter.com/sdepold)
- [IRC](http://webchat.freenode.net?channels=sequelizejs)
- [Google Groups](https://groups.google.com/forum/#!forum/sequelize)
- [XING](https://www.xing.com/net/priec1b5cx/sequelize) (pretty much inactive, but you might want to name it on your profile)

## Running Examples
Instructions for running samples are located in the [example directory](https://github.com/sequelize/sequelize/tree/master/examples). Try these samples in a live sandbox environment:

<a href="https://runnable.com/sequelize" target="_blank"><img src="https://runnable.com/external/styles/assets/runnablebtn.png"></a>
