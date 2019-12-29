'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  _ = require('lodash'),
  moment = require('moment'),
  Operators = require('../../../../lib/operators'),
  QueryGenerator = require('../../../../lib/dialects/sqlite/query-generator');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] QueryGenerator', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      return this.User.sync({ force: true });
    });

    const suites = {
      arithmeticQuery: [
        {
          title: 'Should use the plus operator',
          arguments: ['+', 'myTable', { foo: 'bar' }, {}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`+ \'bar\' '
        },
        {
          title: 'Should use the plus operator with where clause',
          arguments: ['+', 'myTable', { foo: 'bar' }, { bar: 'biz'}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`+ \'bar\' WHERE `bar` = \'biz\''
        },
        {
          title: 'Should use the minus operator',
          arguments: ['-', 'myTable', { foo: 'bar' }],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`- \'bar\' '
        },
        {
          title: 'Should use the minus operator with negative value',
          arguments: ['-', 'myTable', { foo: -1 }],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`- -1 '
        },
        {
          title: 'Should use the minus operator with where clause',
          arguments: ['-', 'myTable', { foo: 'bar' }, { bar: 'biz'}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`- \'bar\' WHERE `bar` = \'biz\''
        }
      ],
      attributesToSQL: [
        {
          arguments: [{id: 'INTEGER'}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: 'INTEGER', foo: 'VARCHAR(255)'}],
          expectation: {id: 'INTEGER', foo: 'VARCHAR(255)'}
        },
        {
          arguments: [{id: {type: 'INTEGER'}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false}}],
          expectation: {id: 'INTEGER NOT NULL'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: true}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', primaryKey: true, autoIncrement: true}}],
          expectation: {id: 'INTEGER PRIMARY KEY AUTOINCREMENT'}
        },
        {
          arguments: [{id: {type: 'INTEGER', defaultValue: 0}}],
          expectation: {id: 'INTEGER DEFAULT 0'}
        },
        {
          arguments: [{id: {type: 'INTEGER', defaultValue: undefined}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', unique: true}}],
          expectation: {id: 'INTEGER UNIQUE'}
        },

        // New references style
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }}}],
          expectation: {id: 'INTEGER REFERENCES `Bar` (`id`)'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar', key: 'pk' }}}],
          expectation: {id: 'INTEGER REFERENCES `Bar` (`pk`)'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }, onDelete: 'CASCADE'}}],
          expectation: {id: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }, onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER REFERENCES `Bar` (`id`) ON UPDATE RESTRICT'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false, defaultValue: 1, references: { model: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT'}
        }
      ],

      createTableQuery: [
        {
          arguments: ['myTable', {data: 'BLOB'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB);'
        },
        {
          arguments: ['myTable', {data: 'LONGBLOB'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB);'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255));'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR BINARY(255)', number: 'INTEGER(5) UNSIGNED PRIMARY KEY '}], // length and unsigned are not allowed on primary key
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR BINARY(255), `number` INTEGER PRIMARY KEY);'
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM(\"A\", \"B\", \"C\"), `name` VARCHAR(255));'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER PRIMARY KEY);'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION);'
        },
        {
          arguments: ['myTable', {id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255));'
        },
        {
          arguments: ['myTable', {id: 'INTEGER PRIMARY KEY AUTOINCREMENT', name: 'VARCHAR(255)', surname: 'VARCHAR(255)'}, {uniqueKeys: {uniqueConstraint: {fields: ['name', 'surname'], customIndex: true }}}],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `name` VARCHAR(255), `surname` VARCHAR(255), UNIQUE (`name`, `surname`));'
        }
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: 'SELECT `id`, `name` FROM `myTable`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`id` = 2;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {where: {name: 'foo'}}],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`name` = 'foo';",
          context: QueryGenerator
        }, {
          arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`name` = 'foo\'\';DROP TABLE myTable;';",
          context: QueryGenerator
        }, {
          arguments: ['myTable', {where: 2}],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`id` = 2;',
          context: QueryGenerator
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) AS `count` FROM `foo`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: ['id']}],
          expectation: 'SELECT * FROM `myTable` ORDER BY `id`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: ['id', 'DESC']}],
          expectation: 'SELECT * FROM `myTable` ORDER BY `id`, `DESC`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: ['myTable.id']}],
          expectation: 'SELECT * FROM `myTable` ORDER BY `myTable`.`id`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: [['myTable.id', 'DESC']]}],
          expectation: 'SELECT * FROM `myTable` ORDER BY `myTable`.`id` DESC;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: [['id', 'DESC']]}, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM `myTable` AS `myTable` ORDER BY `myTable`.`id` DESC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {order: [['id', 'DESC'], ['name']]}, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM `myTable` AS `myTable` ORDER BY `myTable`.`id` DESC, `myTable`.`name`;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'sequelize.where with .fn as attribute and default comparator',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'jan'),
                { type: 1 }
              )
            };
          }],
          expectation: "SELECT * FROM `myTable` WHERE (LOWER(`user`.`name`) = 'jan' AND `myTable`.`type` = 1);",
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'sequelize.where with .fn as attribute and LIKE comparator',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'LIKE', '%t%'),
                { type: 1 }
              )
            };
          }],
          expectation: "SELECT * FROM `myTable` WHERE (LOWER(`user`.`name`) LIKE '%t%' AND `myTable`.`type` = 1);",
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'functions can take functions as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [[sequelize.fn('f1', sequelize.fn('f2', sequelize.col('id'))), 'DESC']]
            };
          }],
          expectation: 'SELECT * FROM `myTable` ORDER BY f1(f2(`id`)) DESC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'functions can take all types as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [
                [sequelize.fn('f1', sequelize.col('myTable.id')), 'DESC'],
                [sequelize.fn('f2', 12, 'lalala', new Date(Date.UTC(2011, 2, 27, 10, 1, 55))), 'ASC']
              ]
            };
          }],
          expectation: "SELECT * FROM `myTable` ORDER BY f1(`myTable`.`id`) DESC, f2(12, 'lalala', '2011-03-27 10:01:55.000 +00:00') ASC;",
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'single string argument should be quoted',
          arguments: ['myTable', {group: 'name'}],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {group: ['name']}],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`;',
          context: QueryGenerator
        }, {
          title: 'functions work for group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))]
            };
          }],
          expectation: 'SELECT * FROM `myTable` GROUP BY YEAR(`createdAt`);',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title']
            };
          }],
          expectation: 'SELECT * FROM `myTable` GROUP BY YEAR(`createdAt`), `title`;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {group: ['name', 'title']}],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`, `title`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {group: 'name', order: [['id', 'DESC']]}],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name` ORDER BY `id` DESC;',
          context: QueryGenerator
        }, {
          title: 'HAVING clause works with where-like hash',
          arguments: ['myTable', function(sequelize) {
            return {
              attributes: ['*', [sequelize.fn('YEAR', sequelize.col('createdAt')), 'creationYear']],
              group: ['creationYear', 'title'],
              having: { creationYear: { gt: 2002 } }
            };
          }],
          expectation: 'SELECT *, YEAR(`createdAt`) AS `creationYear` FROM `myTable` GROUP BY `creationYear`, `title` HAVING `creationYear` > 2002;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: 'SELECT * FROM `myTable` LIMIT 10;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: 'SELECT * FROM `myTable` LIMIT 2, 10;',
          context: QueryGenerator
        }, {
          title: 'uses default limit if only offset is specified',
          arguments: ['myTable', {offset: 2}],
          expectation: 'SELECT * FROM `myTable` LIMIT 2, 10000000000000;',
          context: QueryGenerator
        }, {
          title: 'multiple where arguments',
          arguments: ['myTable', {where: {boat: 'canoe', weather: 'cold'}}],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`boat` = 'canoe' AND `myTable`.`weather` = 'cold';",
          context: QueryGenerator
        }, {
          title: 'no where arguments (object)',
          arguments: ['myTable', {where: {}}],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator
        }, {
          title: 'no where arguments (string)',
          arguments: ['myTable', {where: ['']}],
          expectation: 'SELECT * FROM `myTable` WHERE 1=1;',
          context: QueryGenerator
        }, {
          title: 'no where arguments (null)',
          arguments: ['myTable', {where: null}],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', {where: { field: new Buffer('Sequelize')}}],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`field` = X'53657175656c697a65';",
          context: QueryGenerator
        }, {
          title: 'use != if ne !== null',
          arguments: ['myTable', {where: {field: {ne: 0}}}],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` != 0;',
          context: QueryGenerator
        }, {
          title: 'use IS NOT if ne === null',
          arguments: ['myTable', {where: {field: {ne: null}}}],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` IS NOT NULL;',
          context: QueryGenerator
        }, {
          title: 'use IS NOT if not === BOOLEAN',
          arguments: ['myTable', {where: {field: {not: true}}}],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` IS NOT 1;',
          context: QueryGenerator
        }, {
          title: 'use != if not !== BOOLEAN',
          arguments: ['myTable', {where: {field: {not: 3}}}],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` != 3;',
          context: QueryGenerator
        }
      ],

      insertQuery: [
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo');"
        }, {
          arguments: ['myTable', { name: "'bar'" }],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('''bar''');"
        }, {
          arguments: ['myTable', {data: new Buffer('Sequelize') }],
          expectation: "INSERT INTO `myTable` (`data`) VALUES (X'53657175656c697a65');"
        }, {
          arguments: ['myTable', { name: 'bar', value: null }],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL);"
        }, {
          arguments: ['myTable', { name: 'bar', value: undefined }],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL);"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}],
          expectation: "INSERT INTO `myTable` (`name`,`birthday`) VALUES ('foo','2011-03-27 10:01:55.000 +00:00');"
        }, {
          arguments: ['myTable', { name: 'foo', value: true }],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',1);"
        }, {
          arguments: ['myTable', { name: 'foo', value: false }],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',0);"
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1, nullValue: null}],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL);"
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1, nullValue: null}],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL);",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1, nullValue: null}],
          expectation: "INSERT INTO `myTable` (`name`,`foo`) VALUES ('foo',1);",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1, nullValue: undefined}],
          expectation: "INSERT INTO `myTable` (`name`,`foo`) VALUES ('foo',1);",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              foo: sequelize.fn('NOW')
            };
          }],
          expectation: 'INSERT INTO `myTable` (`foo`) VALUES (NOW());',
          needsSequelize: true
        }
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo'),('bar');"
        }, {
          arguments: ['myTable', [{name: "'bar'"}, {name: 'foo'}]],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('''bar'''),('foo');"
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {name: 'bar', birthday: moment('2012-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}]],
          expectation: "INSERT INTO `myTable` (`name`,`birthday`) VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00');"
        }, {
          arguments: ['myTable', [{name: 'bar', value: null}, {name: 'foo', value: 1}]],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL),('foo',1);"
        }, {
          arguments: ['myTable', [{name: 'bar', value: undefined}, {name: 'bar', value: 2}]],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('bar',NULL),('bar',2);"
        }, {
          arguments: ['myTable', [{name: 'foo', value: true}, {name: 'bar', value: false}]],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',1),('bar',0);"
        }, {
          arguments: ['myTable', [{name: 'foo', value: false}, {name: 'bar', value: false}]],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',0),('bar',0);"
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);"
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: {options: {omitNull: true}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1, nullValue: null}, {name: 'bar', foo: 2, nullValue: null}]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: {options: {omitNull: true}} // Note: As above
        }, {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}], {ignoreDuplicates: true}],
          expectation: "INSERT OR IGNORE INTO `myTable` (`name`) VALUES ('foo'),('bar');"
        }
      ],

      updateQuery: [
        {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE `myTable` SET `name`='foo',`birthday`='2011-03-27 10:01:55.000 +00:00' WHERE `id` = 2"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE `myTable` SET `name`='foo',`birthday`='2011-03-27 10:01:55.000 +00:00' WHERE `id` = 2"
        }, {
          arguments: ['myTable', { name: 'foo' }, { id: 2 }],
          expectation: "UPDATE `myTable` SET `name`='foo' WHERE `id` = 2"
        }, {
          arguments: ['myTable', { name: "'bar'" }, { id: 2 }],
          expectation: "UPDATE `myTable` SET `name`='''bar''' WHERE `id` = 2"
        }, {
          arguments: ['myTable', { name: 'bar', value: null }, { id: 2 }],
          expectation: "UPDATE `myTable` SET `name`='bar',`value`=NULL WHERE `id` = 2"
        }, {
          arguments: ['myTable', { name: 'bar', value: undefined }, { id: 2 }],
          expectation: "UPDATE `myTable` SET `name`='bar',`value`=NULL WHERE `id` = 2"
        }, {
          arguments: ['myTable', { flag: true }, { id: 2 }],
          expectation: 'UPDATE `myTable` SET `flag`=1 WHERE `id` = 2'
        }, {
          arguments: ['myTable', { flag: false }, { id: 2 }],
          expectation: 'UPDATE `myTable` SET `flag`=0 WHERE `id` = 2'
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE `myTable` SET `bar`=2,`nullValue`=NULL WHERE `name` = 'foo'"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE `myTable` SET `bar`=2,`nullValue`=NULL WHERE `name` = 'foo'",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE `myTable` SET `bar`=2 WHERE `name` = 'foo'",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.fn('NOW')
            };
          }, {name: 'foo'}],
          expectation: "UPDATE `myTable` SET `bar`=NOW() WHERE `name` = 'foo'",
          needsSequelize: true
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.col('foo')
            };
          }, {name: 'foo'}],
          expectation: "UPDATE `myTable` SET `bar`=`foo` WHERE `name` = 'foo'",
          needsSequelize: true
        }
      ],
      renameColumnQuery: [
        {
          title: 'Properly quotes column names',
          arguments: ['myTable', 'foo', 'commit', {commit: 'VARCHAR(255)', bar: 'VARCHAR(255)'}],
          expectation:
            'CREATE TEMPORARY TABLE IF NOT EXISTS `myTable_backup` (`commit` VARCHAR(255), `bar` VARCHAR(255));' +
            'INSERT INTO `myTable_backup` SELECT `foo` AS `commit`, `bar` FROM `myTable`;' +
            'DROP TABLE `myTable`;' +
            'CREATE TABLE IF NOT EXISTS `myTable` (`commit` VARCHAR(255), `bar` VARCHAR(255));' +
            'INSERT INTO `myTable` SELECT `commit`, `bar` FROM `myTable_backup`;' +
            'DROP TABLE `myTable_backup`;'
        }
      ],
      removeColumnQuery: [
        {
          title: 'Properly quotes column names',
          arguments: ['myTable', {commit: 'VARCHAR(255)', bar: 'VARCHAR(255)'}],
          expectation:
            'CREATE TABLE IF NOT EXISTS `myTable_backup` (`commit` VARCHAR(255), `bar` VARCHAR(255));' +
            'INSERT INTO `myTable_backup` SELECT `commit`, `bar` FROM `myTable`;' +
            'DROP TABLE `myTable`;' +
            'CREATE TABLE IF NOT EXISTS `myTable` (`commit` VARCHAR(255), `bar` VARCHAR(255));' +
            'INSERT INTO `myTable` SELECT `commit`, `bar` FROM `myTable_backup`;' +
            'DROP TABLE `myTable_backup`;'
        }
      ]
    };

    _.each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        tests.forEach(test => {
          const title = test.title || 'SQLite correctly returns ' + test.expectation + ' for ' + JSON.stringify(test.arguments);
          it(title, function() {
            // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
            const context = test.context || {options: {}};
            if (test.needsSequelize) {
              if (_.isFunction(test.arguments[1])) test.arguments[1] = test.arguments[1](this.sequelize);
              if (_.isFunction(test.arguments[2])) test.arguments[2] = test.arguments[2](this.sequelize);
            }
            QueryGenerator.options = _.assign(context.options, { timezone: '+00:00' });
            QueryGenerator._dialect = this.sequelize.dialect;
            QueryGenerator.sequelize = this.sequelize;
            QueryGenerator.setOperatorsAliases(Operators.LegacyAliases);
            const conditions = QueryGenerator[suiteTitle].apply(QueryGenerator, test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
          });
        });
      });
    });
  });
}
