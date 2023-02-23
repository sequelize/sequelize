'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  _ = require('lodash'),
  Op = require('sequelize/lib/operators'),
  IndexHints = require('sequelize/lib/index-hints'),
  QueryGenerator = require('sequelize/lib/dialects/mariadb/query-generator');

if (dialect === 'mariadb') {
  describe('[MARIADB Specific] QueryGenerator', () => {
    const suites = {
      createDatabaseQuery: [
        {
          arguments: ['myDatabase'],
          expectation: 'CREATE DATABASE IF NOT EXISTS `myDatabase`;'
        },
        {
          arguments: ['myDatabase', { charset: 'utf8mb4' }],
          expectation: 'CREATE DATABASE IF NOT EXISTS `myDatabase` DEFAULT CHARACTER SET \'utf8mb4\';'
        },
        {
          arguments: ['myDatabase', { collate: 'utf8mb4_unicode_ci' }],
          expectation: 'CREATE DATABASE IF NOT EXISTS `myDatabase` DEFAULT COLLATE \'utf8mb4_unicode_ci\';'
        },
        {
          arguments: ['myDatabase', { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }],
          expectation: 'CREATE DATABASE IF NOT EXISTS `myDatabase` DEFAULT CHARACTER SET \'utf8mb4\' DEFAULT COLLATE \'utf8mb4_unicode_ci\';'
        }
      ],
      dropDatabaseQuery: [
        {
          arguments: ['myDatabase'],
          expectation: 'DROP DATABASE IF EXISTS `myDatabase`;'
        }
      ],
      createSchema: [
        {
          arguments: ['mySchema'],
          expectation: 'CREATE SCHEMA IF NOT EXISTS `mySchema`;'
        },
        {
          arguments: ['mySchema', { charset: 'utf8mb4' }],
          expectation: 'CREATE SCHEMA IF NOT EXISTS `mySchema` DEFAULT CHARACTER SET \'utf8mb4\';'
        },
        {
          arguments: ['mySchema', { collate: 'utf8mb4_unicode_ci' }],
          expectation: 'CREATE SCHEMA IF NOT EXISTS `mySchema` DEFAULT COLLATE \'utf8mb4_unicode_ci\';'
        },
        {
          arguments: ['mySchema', { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }],
          expectation: 'CREATE SCHEMA IF NOT EXISTS `mySchema` DEFAULT CHARACTER SET \'utf8mb4\' DEFAULT COLLATE \'utf8mb4_unicode_ci\';'
        }
      ],
      dropSchema: [
        {
          arguments: ['mySchema'],
          expectation: 'DROP SCHEMA IF EXISTS `mySchema`;'
        }
      ],
      showSchemasQuery: [
        {
          arguments: [{}],
          expectation: 'SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\');'
        },
        {
          arguments: [{ skip: [] }],
          expectation: 'SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\');'
        },
        {
          arguments: [{ skip: ['test'] }],
          expectation: 'SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\', \'test\');'
        },
        {
          arguments: [{ skip: ['test', 'Te\'st2'] }],
          expectation: 'SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\', \'test\', \'Te\\\'st2\');'
        }

      ],
      arithmeticQuery: [
        {
          title: 'Should use the plus operator',
          arguments: ['+', 'myTable', {}, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`+ \'bar\''
        },
        {
          title: 'Should use the plus operator with where clause',
          arguments: ['+', 'myTable', { bar: 'biz' }, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`+ \'bar\' WHERE `bar` = \'biz\''
        },
        {
          title: 'Should use the minus operator',
          arguments: ['-', 'myTable', {}, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`- \'bar\''
        },
        {
          title: 'Should use the minus operator with negative value',
          arguments: ['-', 'myTable', {}, { foo: -1 }, {}, {}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`- -1'
        },
        {
          title: 'Should use the minus operator with where clause',
          arguments: ['-', 'myTable', { bar: 'biz' }, { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE `myTable` SET `foo`=`foo`- \'bar\' WHERE `bar` = \'biz\''
        }
      ],
      attributesToSQL: [
        {
          arguments: [{ id: 'INTEGER' }],
          expectation: { id: 'INTEGER' }
        },
        {
          arguments: [{ id: 'INTEGER', foo: 'VARCHAR(255)' }],
          expectation: { id: 'INTEGER', foo: 'VARCHAR(255)' }
        },
        {
          arguments: [{ id: { type: 'INTEGER' } }],
          expectation: { id: 'INTEGER' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false } }],
          expectation: { id: 'INTEGER NOT NULL' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: true } }],
          expectation: { id: 'INTEGER' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', primaryKey: true, autoIncrement: true } }],
          expectation: { id: 'INTEGER auto_increment PRIMARY KEY' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', defaultValue: 0 } }],
          expectation: { id: 'INTEGER DEFAULT 0' }
        },
        {
          title: 'Add column level comment',
          arguments: [{ id: { type: 'INTEGER', comment: 'Test' } }],
          expectation: { id: 'INTEGER COMMENT \'Test\'' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true } }],
          expectation: { id: 'INTEGER UNIQUE' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', after: 'Bar' } }],
          expectation: { id: 'INTEGER AFTER `Bar`' }
        },
        // No Default Values allowed for certain types
        {
          title: 'No Default value for MariaDB BLOB allowed',
          arguments: [{ id: { type: 'BLOB', defaultValue: [] } }],
          expectation: { id: 'BLOB' }
        },
        {
          title: 'No Default value for MariaDB TEXT allowed',
          arguments: [{ id: { type: 'TEXT', defaultValue: [] } }],
          expectation: { id: 'TEXT' }
        },
        {
          title: 'No Default value for MariaDB GEOMETRY allowed',
          arguments: [{ id: { type: 'GEOMETRY', defaultValue: [] } }],
          expectation: { id: 'GEOMETRY' }
        },
        {
          title: 'No Default value for MariaDB JSON allowed',
          arguments: [{ id: { type: 'JSON', defaultValue: [] } }],
          expectation: { id: 'JSON' }
        },
        // New references style
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`id`)' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`pk`)' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' }, onDelete: 'CASCADE' } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' }, onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`id`) ON UPDATE RESTRICT' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false, autoIncrement: true, defaultValue: 1, references: { model: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER NOT NULL auto_increment DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT' }
        }
      ],

      createTableQuery: [
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB;'
        },
        {
          arguments: ['myTable', { data: 'BLOB' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` BLOB) ENGINE=InnoDB;'
        },
        {
          arguments: ['myTable', { data: 'LONGBLOB' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`data` LONGBLOB) ENGINE=InnoDB;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { engine: 'MyISAM' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=MyISAM;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'utf8', collate: 'utf8_unicode_ci' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'latin1' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;'
        },
        {
          arguments: ['myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }, { charset: 'latin1' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` ENUM("A", "B", "C"), `name` VARCHAR(255)) ENGINE=InnoDB DEFAULT CHARSET=latin1;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { rowFormat: 'default' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255)) ENGINE=InnoDB ROW_FORMAT=default;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `id` INTEGER , PRIMARY KEY (`id`)) ENGINE=InnoDB;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION' }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), `otherId` INTEGER, FOREIGN KEY (`otherId`) REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB;'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { uniqueKeys: [{ fields: ['title', 'name'], customIndex: true }] }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`title` VARCHAR(255), `name` VARCHAR(255), UNIQUE `uniq_myTable_title_name` (`title`, `name`)) ENGINE=InnoDB;'
        },
        {
          arguments: ['myTable', { id: 'INTEGER auto_increment PRIMARY KEY' }, { initialAutoIncrement: 1000001 }],
          expectation: 'CREATE TABLE IF NOT EXISTS `myTable` (`id` INTEGER auto_increment , PRIMARY KEY (`id`)) ENGINE=InnoDB AUTO_INCREMENT=1000001;'
        }
      ],

      dropTableQuery: [
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS `myTable`;'
        }
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT `id`, `name` FROM `myTable`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`id` = 2;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`name` = 'foo';",
          context: QueryGenerator
        }, {
          arguments: ['myTable', { where: { name: "foo';DROP TABLE myTable;" } }],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`name` = 'foo\\';DROP TABLE myTable;';",
          context: QueryGenerator
        }, {
          arguments: ['myTable', { where: 2 }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`id` = 2;',
          context: QueryGenerator
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) AS `count` FROM `foo`;',
          context: { options: {  attributeBehavior: 'unsafe-legacy' } }
        }, {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `id`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `id`, `DESC`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `myTable`.`id`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `myTable`.`id` DESC;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: [['id', 'DESC']] }, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM `myTable` AS `myTable` ORDER BY `myTable`.`id` DESC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', { order: [['id', 'DESC'], ['name']] }, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM `myTable` AS `myTable` ORDER BY `myTable`.`id` DESC, `myTable`.`name`;',
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
          expectation: "SELECT * FROM `myTable` ORDER BY f1(`myTable`.`id`) DESC, f2(12, 'lalala', '2011-03-27 10:01:55.000') ASC;",
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
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { group: ['name'] }],
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
          arguments: ['myTable', { group: 'name', order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name` ORDER BY `id` DESC;',
          context: QueryGenerator
        }, {
          title: 'HAVING clause works with where-like hash',
          arguments: ['myTable', function(sequelize) {
            return {
              attributes: ['*', [sequelize.fn('YEAR', sequelize.col('createdAt')), 'creationYear']],
              group: ['creationYear', 'title'],
              having: { creationYear: { [Op.gt]: 2002 } }
            };
          }],
          expectation: 'SELECT *, YEAR(`createdAt`) AS `creationYear` FROM `myTable` GROUP BY `creationYear`, `title` HAVING `creationYear` > 2002;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'Combination of sequelize.fn, sequelize.col and { in: ... }',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                { archived: null },
                sequelize.where(sequelize.fn('COALESCE', sequelize.col('place_type_codename'), sequelize.col('announcement_type_codename')), { [Op.in]: ['Lost', 'Found'] })
              )
            };
          }],
          expectation: "SELECT * FROM `myTable` WHERE (`myTable`.`archived` IS NULL AND COALESCE(`place_type_codename`, `announcement_type_codename`) IN ('Lost', 'Found'));",
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', { limit: 10 }],
          expectation: 'SELECT * FROM `myTable` LIMIT 10;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', { limit: 10, offset: 2 }],
          expectation: 'SELECT * FROM `myTable` LIMIT 2, 10;',
          context: QueryGenerator
        }, {
          title: 'uses default limit if only offset is specified',
          arguments: ['myTable', { offset: 2 }],
          expectation: 'SELECT * FROM `myTable` LIMIT 2, 10000000000000;',
          context: QueryGenerator
        }, {
          title: 'uses limit 0',
          arguments: ['myTable', { limit: 0 }],
          expectation: 'SELECT * FROM `myTable` LIMIT 0;',
          context: QueryGenerator
        }, {
          title: 'uses offset 0',
          arguments: ['myTable', { offset: 0 }],
          expectation: 'SELECT * FROM `myTable` LIMIT 0, 10000000000000;',
          context: QueryGenerator
        }, {
          title: 'multiple where arguments',
          arguments: ['myTable', { where: { boat: 'canoe', weather: 'cold' } }],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`boat` = 'canoe' AND `myTable`.`weather` = 'cold';",
          context: QueryGenerator
        }, {
          title: 'no where arguments (object)',
          arguments: ['myTable', { where: {} }],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator
        }, {
          title: 'no where arguments (string)',
          arguments: ['myTable', { where: [''] }],
          expectation: 'SELECT * FROM `myTable` WHERE 1=1;',
          context: QueryGenerator
        }, {
          title: 'no where arguments (null)',
          arguments: ['myTable', { where: null }],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', { where: { field: Buffer.from('Sequelize') } }],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`field` = X'53657175656c697a65';",
          context: QueryGenerator
        }, {
          title: 'use != if ne !== null',
          arguments: ['myTable', { where: { field: { [Op.ne]: 0 } } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` != 0;',
          context: QueryGenerator
        }, {
          title: 'use IS NOT if ne === null',
          arguments: ['myTable', { where: { field: { [Op.ne]: null } } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` IS NOT NULL;',
          context: QueryGenerator
        }, {
          title: 'use IS NOT if not === BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: true } } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` IS NOT true;',
          context: QueryGenerator
        }, {
          title: 'use != if not !== BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: 3 } } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`field` != 3;',
          context: QueryGenerator
        }, {
          title: 'Regular Expression in where clause',
          arguments: ['myTable', { where: { field: { [Op.regexp]: '^[h|a|t]' } } }],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`field` REGEXP '^[h|a|t]';",
          context: QueryGenerator
        }, {
          title: 'Regular Expression negation in where clause',
          arguments: ['myTable', { where: { field: { [Op.notRegexp]: '^[h|a|t]' } } }],
          expectation: "SELECT * FROM `myTable` WHERE `myTable`.`field` NOT REGEXP '^[h|a|t]';",
          context: QueryGenerator
        }, {
          title: 'Empty having',
          arguments: ['myTable', function() {
            return {
              having: {}
            };
          }],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'Having in subquery',
          arguments: ['myTable', function() {
            return {
              subQuery: true,
              tableAs: 'test',
              having: { creationYear: { [Op.gt]: 2002 } }
            };
          }],
          expectation: 'SELECT `test`.* FROM (SELECT * FROM `myTable` AS `test` HAVING `creationYear` > 2002) AS `test`;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'Contains fields with "." characters.',
          arguments: ['myTable', {
            attributes: ['foo.bar.baz'],
            model: {
              rawAttributes: {
                'foo.bar.baz': {}
              }
            }
          }],
          expectation: 'SELECT `foo.bar.baz` FROM `myTable`;',
          context: QueryGenerator
        }
      ],

      insertQuery: [
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`) VALUES ($1);',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`) VALUES ($1);',
            bind: ["foo';DROP TABLE myTable;"]
          }
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`,`birthday`) VALUES ($1,$2);',
            bind: ['foo', new Date(Date.UTC(2011, 2, 27, 10, 1, 55))]
          }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`,`foo`) VALUES ($1,$2);',
            bind: ['foo', 1]
          }
        }, {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO `myTable` (`data`) VALUES ($1);',
            bind: [Buffer.from('Sequelize')]
          }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ($1,$2,$3);',
            bind: ['foo', 1, null]
          }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ($1,$2,$3);',
            bind: ['foo', 1, null]
          },
          context: { options: { omitNull: false } }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`,`foo`) VALUES ($1,$2);',
            bind: ['foo', 1]
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO `mySchema`.`myTable` (`name`,`foo`) VALUES ($1,$2);',
            bind: ['foo', 1]
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO `myTable` (`name`,`foo`) VALUES ($1,$2);',
            bind: ['foo', 1]
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: ['myTable', { foo: false }],
          expectation: {
            query: 'INSERT INTO `myTable` (`foo`) VALUES ($1);',
            bind: [false]
          }
        }, {
          arguments: ['myTable', { foo: true }],
          expectation: {
            query: 'INSERT INTO `myTable` (`foo`) VALUES ($1);',
            bind: [true]
          }
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              foo: sequelize.fn('NOW')
            };
          }],
          expectation: {
            query: 'INSERT INTO `myTable` (`foo`) VALUES (NOW());',
            bind: []
          },
          needsSequelize: true
        }
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo'),('bar');"
        }, {
          arguments: ['myTable', [{ name: "foo';DROP TABLE myTable;" }, { name: 'bar' }]],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo\\';DROP TABLE myTable;'),('bar');"
        }, {
          arguments: ['myTable', [{ name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) }]],
          expectation: "INSERT INTO `myTable` (`name`,`birthday`) VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000');"
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1 }, { name: 'bar', foo: 2 }]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`) VALUES ('foo',1),('bar',2);"
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',NULL,NULL);"
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', foo: 2, nullValue: null }]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: { options: { omitNull: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', foo: 2, nullValue: null }]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: { options: { omitNull: true } } // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: undefined }, { name: 'bar', foo: 2, undefinedValue: undefined }]],
          expectation: "INSERT INTO `myTable` (`name`,`foo`,`nullValue`,`undefinedValue`) VALUES ('foo',1,NULL,NULL),('bar',2,NULL,NULL);",
          context: { options: { omitNull: true } } // Note: As above
        }, {
          arguments: ['myTable', [{ name: 'foo', value: true }, { name: 'bar', value: false }]],
          expectation: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',true),('bar',false);"
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }],
          expectation: "INSERT IGNORE INTO `myTable` (`name`) VALUES ('foo'),('bar');"
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { updateOnDuplicate: ['name'] }],
          expectation: "INSERT INTO `myTable` (`name`) VALUES ('foo'),('bar') ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);"
        }
      ],

      updateQuery: [
        {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE `myTable` SET `name`=$1,`birthday`=$2 WHERE `id` = $3',
            bind: ['foo', new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), 2]
          }

        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE `myTable` SET `name`=$1,`birthday`=$2 WHERE `id` = $3',
            bind: ['foo', new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), 2]
          }
        }, {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$1 WHERE `name` = $2',
            bind: [2, 'foo']
          }
        }, {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `name`=$1 WHERE `name` = $2',
            bind: ["foo';DROP TABLE myTable;", 'foo']
          }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$1,`nullValue`=$2 WHERE `name` = $3',
            bind: [2, null, 'foo']
          }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$1,`nullValue`=$2 WHERE `name` = $3',
            bind: [2, null, 'foo']
          },
          context: { options: { omitNull: false } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$1 WHERE `name` = $2',
            bind: [2, 'foo']
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: ['myTable', { bar: false }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$1 WHERE `name` = $2',
            bind: [false, 'foo']
          }
        }, {
          arguments: ['myTable', { bar: true }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$1 WHERE `name` = $2',
            bind: [true, 'foo']
          }
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.fn('NOW')
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=NOW() WHERE `name` = $1',
            bind: ['foo']
          },
          needsSequelize: true
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.col('foo')
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=`foo` WHERE `name` = $1',
            bind: ['foo']
          },
          needsSequelize: true
        }
      ],

      showIndexesQuery: [
        {
          arguments: ['User'],
          expectation: 'SHOW INDEX FROM `User`'
        }, {
          arguments: ['User', { database: 'sequelize' }],
          expectation: 'SHOW INDEX FROM `User` FROM `sequelize`'
        }
      ],

      removeIndexQuery: [
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX `user_foo_bar` ON `User`'
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX `user_foo_bar` ON `User`'
        }
      ],
      getForeignKeyQuery: [
        {
          arguments: ['User', 'email'],
          expectation: "SELECT CONSTRAINT_NAME as constraint_name,CONSTRAINT_NAME as constraintName,CONSTRAINT_SCHEMA as constraintSchema,CONSTRAINT_SCHEMA as constraintCatalog,TABLE_NAME as tableName,TABLE_SCHEMA as tableSchema,TABLE_SCHEMA as tableCatalog,COLUMN_NAME as columnName,REFERENCED_TABLE_SCHEMA as referencedTableSchema,REFERENCED_TABLE_SCHEMA as referencedTableCatalog,REFERENCED_TABLE_NAME as referencedTableName,REFERENCED_COLUMN_NAME as referencedColumnName FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE (REFERENCED_TABLE_NAME = 'User' AND REFERENCED_COLUMN_NAME = 'email') OR (TABLE_NAME = 'User' AND COLUMN_NAME = 'email' AND REFERENCED_TABLE_NAME IS NOT NULL)"
        }
      ],

      selectFromTableFragment: [
        {
          arguments: [{}, null, ['*'], '`Project`'],
          expectation: 'SELECT * FROM `Project`'
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.USE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '`Project`'
          ],
          expectation: 'SELECT * FROM `Project` USE INDEX (`index_project_on_name`)'
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.FORCE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '`Project`'
          ],
          expectation: 'SELECT * FROM `Project` FORCE INDEX (`index_project_on_name`)'
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.IGNORE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '`Project`'
          ],
          expectation: 'SELECT * FROM `Project` IGNORE INDEX (`index_project_on_name`)'
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.USE, values: ['index_project_on_name', 'index_project_on_name_and_foo'] }] },
            null,
            ['*'],
            '`Project`'
          ],
          expectation: 'SELECT * FROM `Project` USE INDEX (`index_project_on_name`,`index_project_on_name_and_foo`)'
        }, {
          arguments: [
            { indexHints: [{ type: 'FOO', values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '`Project`'
          ],
          expectation: 'SELECT * FROM `Project`'
        }
      ]
    };

    _.each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        beforeEach(function() {
          this.queryGenerator = new QueryGenerator({
            sequelize: this.sequelize,
            _dialect: this.sequelize.dialect
          });
        });

        tests.forEach(test => {
          const query = test.expectation.query || test.expectation;
          const title = test.title || `MariaDB correctly returns ${query} for ${JSON.stringify(test.arguments)}`;
          it(title, function() {
            if (test.needsSequelize) {
              if (typeof test.arguments[1] === 'function') test.arguments[1] = test.arguments[1](this.sequelize);
              if (typeof test.arguments[2] === 'function') test.arguments[2] = test.arguments[2](this.sequelize);
            }

            // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
            this.queryGenerator.options = { ...this.queryGenerator.options, ...test.context && test.context.options };

            const conditions = this.queryGenerator[suiteTitle](...test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
          });
        });
      });
    });
  });
}
