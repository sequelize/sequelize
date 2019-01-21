'use strict';

const Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  expect = require('chai').expect,
  expectsql = Support.expectsql,
  Sequelize = Support.Sequelize,
  current = Support.sequelize,
  util = require('util'),
  sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
if (current.dialect.supports.JSON) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('JSON', () => {
      describe('escape', () => {
        it('plain string', () => {
          expectsql(sql.escape('string', { type: new DataTypes.JSON() }), {
            default: '\'"string"\'',
            mariadb: '\'\\"string\\"\'',
            mysql: '\'\\"string\\"\''
          });
        });

        it('plain int', () => {
          expectsql(sql.escape(0, { type: new DataTypes.JSON() }), {
            default: '\'0\''
          });
          expectsql(sql.escape(123, { type: new DataTypes.JSON() }), {
            default: '\'123\''
          });
        });

        it('boolean', () => {
          expectsql(sql.escape(true, { type: new DataTypes.JSON() }), {
            default: '\'true\''
          });
          expectsql(sql.escape(false, { type: new DataTypes.JSON() }), {
            default: '\'false\''
          });
        });

        it('NULL', () => {
          expectsql(sql.escape(null, { type: new DataTypes.JSON() }), {
            default: 'NULL'
          });
        });

        it('nested object', () => {
          expectsql(sql.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: new DataTypes.JSON() }), {
            default: '\'{"some":"nested","more":{"nested":true},"answer":42}\'',
            mariadb: '\'{\\"some\\":\\"nested\\",\\"more\\":{\\"nested\\":true},\\"answer\\":42}\'',
            mysql: '\'{\\"some\\":\\"nested\\",\\"more\\":{\\"nested\\":true},\\"answer\\":42}\''
          });
        });

        if (current.dialect.supports.ARRAY) {
          it('array of JSON', () => {
            expectsql(sql.escape([
              { some: 'nested', more: { nested: true }, answer: 42 },
              43,
              'joe'
            ], { type: DataTypes.ARRAY(DataTypes.JSON) }), {
              postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSON[]'
            });
          });

          if (current.dialect.supports.JSONB) {
            it('array of JSONB', () => {
              expectsql(sql.escape([
                { some: 'nested', more: { nested: true }, answer: 42 },
                43,
                'joe'
              ], { type: DataTypes.ARRAY(DataTypes.JSONB) }), {
                postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSONB[]'
              });
            });
          }
        }
      });

      describe('path extraction', () => {
        const testsql = function(key, value, options, expectation) {
          if (expectation === undefined) {
            expectation = options;
            options = undefined;
          }

          it(`${ String(key) }: ${ util.inspect(value, { depth: 10 }) }${ options && `, ${ util.inspect(options) }` || '' }`, () => {
            return expectsql(sql.composeQuery(sql.whereItemQuery(key, value, options)), expectation);
          });
        };

        describe('condition object', () => {
          testsql(undefined, Sequelize.json({ id: 1 }), {
            query: {
              postgres: '("id"#>>$1) = $2;',
              sqlite: 'json_extract(`id`, ?1) = ?2;',
              mysql: 'json_unquote(json_extract(`id`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`id`,?)) = ?;'
            },
            bind: {
              postgres: ['{}', 1],
              sqlite: ['$', 1],
              mysql: ['$.', 1],
              mariadb: ['$.', 1]
            }
          });
        });

        describe('nested condition object', () => {
          testsql(undefined, Sequelize.json({ profile: { id: 1 } }), {
            query: {
              postgres: '("profile"#>>$1) = $2;',
              sqlite: 'json_extract(`profile`, ?1) = ?2;',
              mysql: 'json_unquote(json_extract(`profile`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`profile`,?)) = ?;'
            },
            bind: {
              postgres: ['{id}', 1],
              default: ['$.id', 1]
            }
          });
        });

        describe('multiple condition object', () => {
          testsql(undefined, Sequelize.json({ property: { value: 1 }, another: { value: 'string' } }), {
            query: {
              postgres: '("property"#>>$1) = $2 AND ("another"#>>$3) = $4;',
              sqlite: 'json_extract(`property`, ?1) = ?2 AND json_extract(`another`, ?3) = ?4;',
              mysql: 'json_unquote(json_extract(`property`,?)) = ? and json_unquote(json_extract(`another`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`property`,?)) = ? and json_unquote(json_extract(`another`,?)) = ?;'
            },
            bind: {
              postgres: ['{value}', 1, '{value}', 'string'],
              sqlite: ['$.value', 1, '$.value', 'string'],
              mysql: ['$.value', 1, '$.value', 'string'],
              mariadb: ['$.value', 1, '$.value', 'string']
            }
          });
        });

        describe('property array object', () => {
          testsql(undefined, Sequelize.json({ property: [[4, 6], [8]] }), {
            query: {
              postgres: '("property"#>>$1) = $2 AND ("property"#>>$3) = $4 AND ("property"#>>$5) = $6;',
              sqlite: 'json_extract(`property`, ?1) = ?2 AND json_extract(`property`, ?3) = ?4 AND json_extract(`property`, ?5) = ?6;',
              mysql: 'json_unquote(json_extract(`property`,?)) = ? and json_unquote(json_extract(`property`,?)) = ? and json_unquote(json_extract(`property`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`property`,?)) = ? and json_unquote(json_extract(`property`,?)) = ? and json_unquote(json_extract(`property`,?)) = ?;'
            },
            bind: {
              postgres: ['{0,0}', 4, '{0,1}', 6, '{1,0}', 8],
              sqlite: ['$[0][0]', 4, '$[0][1]', 6, '$[1][0]', 8],
              default: ['$.0.0', 4, '$.0.1', 6, '$.1.0', 8]
            }
          });
        });

        describe('dot notation', () => {
          testsql(Sequelize.json('profile.id'), '1', {
            query: {
              postgres: '("profile"#>>$1) = $2;',
              sqlite: 'json_extract(`profile`, ?1) = ?2;',
              mysql: 'json_unquote(json_extract(`profile`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`profile`,?)) = ?;'
            },
            bind: {
              postgres: ['{id}', '1'],
              default: ['$.id', '1']
            }
          });
        });

        describe('item dot notation array', () => {
          testsql(Sequelize.json('profile.id.0.1'), '1', {
            query: {
              postgres: '("profile"#>>$1) = $2;',
              sqlite: 'json_extract(`profile`, ?1) = ?2;',
              mysql: 'json_unquote(json_extract(`profile`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`profile`,?)) = ?;'
            },
            bind: {
              postgres: ['{id,0,1}', '1'],
              default: ['$.id[0][1]', '1']
            }
          });
        });

        describe('column named "json"', () => {
          testsql(Sequelize.json('json'), '{}', {
            query: {
              postgres: '("json"#>>$1) = $2;',
              sqlite: 'json_extract(`json`, ?1) = ?2;',
              mysql: 'json_unquote(json_extract(`json`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`json`,?)) = ?;'
            },
            bind: {
              postgres: ['{}', '{}'],
              sqlite: ['$', '{}'],
              mysql: ['$.', '{}'],
              mariadb: ['$.', '{}']
            }
          });
        });
      });

      describe('raw json query', () => {
        if (current.dialect.name === 'postgres') {
          it('#>> operator', () => {
            expectsql(sql.composeQuery(sql.whereItemQuery(Sequelize.json('("data"#>>\'{id}\')'), 'id')), {
              query: {
                postgres: '("data"#>>\'{id}\') = $1;'
              },
              bind: {
                postgres: ['id']
              }
            });
          });
        }

        it('json function', () => {
          expectsql(sql.composeQuery(sql.handleSequelizeMethod(Sequelize.json('json(\'{"profile":{"name":"david"}}\')'))), {
            default: 'json(\'{"profile":{"name":"david"}}\');'
          });
        });

        it('nested json functions', () => {
          expectsql(sql.composeQuery(sql.handleSequelizeMethod(Sequelize.json('json_extract(json_object(\'{"profile":null}\'), "profile")'))), {
            default: 'json_extract(json_object(\'{"profile":null}\'), "profile");'
          });
        });

        it('escaped string argument', () => {
          expectsql(sql.composeQuery(sql.handleSequelizeMethod(Sequelize.json('json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')'))), {
            default: 'json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\');'
          });
        });

        it('unbalnced statement', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json())'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json_extract(json()'))).to.throw();
        });

        it('separator injection', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(; DELETE YOLO INJECTIONS; -- )'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(); DELETE YOLO INJECTIONS; -- '))).to.throw();
        });
      });
    });
  });
}
