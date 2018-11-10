'use strict';

const Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  expect = require('chai').expect,
  expectsql = Support.expectsql,
  Sequelize = Support.Sequelize,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
if (current.dialect.supports.JSON) {
  suite(Support.getTestDialectTeaser('SQL'), () => {
    suite('JSON', () => {
      suite('escape', () => {
        test('plain string', () => {
          expectsql(sql.escape('string', { type: new DataTypes.JSON() }), {
            default: '\'"string"\'',
            mysql: '\'\\"string\\"\''
          });
        });

        test('plain int', () => {
          expectsql(sql.escape(0, { type: new DataTypes.JSON() }), {
            default: '\'0\''
          });
          expectsql(sql.escape(123, { type: new DataTypes.JSON() }), {
            default: '\'123\''
          });
        });

        test('boolean', () => {
          expectsql(sql.escape(true, { type: new DataTypes.JSON() }), {
            default: '\'true\''
          });
          expectsql(sql.escape(false, { type: new DataTypes.JSON() }), {
            default: '\'false\''
          });
        });

        test('NULL', () => {
          expectsql(sql.escape(null, { type: new DataTypes.JSON() }), {
            default: 'NULL'
          });
        });

        test('nested object', () => {
          expectsql(sql.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: new DataTypes.JSON() }), {
            default: '\'{"some":"nested","more":{"nested":true},"answer":42}\'',
            mysql: '\'{\\"some\\":\\"nested\\",\\"more\\":{\\"nested\\":true},\\"answer\\":42}\''
          });
        });

        if (current.dialect.supports.ARRAY) {
          test('array of JSON', () => {
            expectsql(sql.escape([
              { some: 'nested', more: { nested: true }, answer: 42 },
              43,
              'joe'
            ], { type: DataTypes.ARRAY(DataTypes.JSON) }), {
              postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSON[]'
            });
          });

          if (current.dialect.supports.JSONB) {
            test('array of JSONB', () => {
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

      suite('path extraction', () => {
        test('condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ id: 1 })), {
            postgres: '("id"#>>\'{}\') = \'1\'',
            sqlite: "json_extract(`id`, '$') = '1'",
            mysql: "`id`->>'$.' = '1'"
          });
        });

        test('nested condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ profile: { id: 1 } })), {
            postgres: '("profile"#>>\'{id}\') = \'1\'',
            sqlite: "json_extract(`profile`, '$.id') = '1'",
            mysql: "`profile`->>'$.id' = '1'"
          });
        });

        test('multiple condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ property: { value: 1 }, another: { value: 'string' } })), {
            postgres: '("property"#>>\'{value}\') = \'1\' AND ("another"#>>\'{value}\') = \'string\'',
            sqlite: "json_extract(`property`, '$.value') = '1' AND json_extract(`another`, '$.value') = 'string'",
            mysql: "`property`->>'$.value' = '1' and `another`->>'$.value' = 'string'"
          });
        });

        test('dot notation', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('profile.id'), '1'), {
            postgres: '("profile"#>>\'{id}\') = \'1\'',
            sqlite: "json_extract(`profile`, '$.id') = '1'",
            mysql: "`profile`->>'$.id' = '1'"
          });
        });

        test('column named "json"', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('json'), '{}'), {
            postgres: '("json"#>>\'{}\') = \'{}\'',
            sqlite: "json_extract(`json`, '$') = '{}'",
            mysql: "`json`->>'$.' = '{}'"
          });
        });
      });

      suite('raw json query', () => {
        if (current.dialect.name === 'postgres') {
          test('#>> operator', () => {
            expectsql(sql.whereItemQuery(Sequelize.json('("data"#>>\'{id}\')'), 'id'), {
              postgres: '("data"#>>\'{id}\') = \'id\''
            });
          });
        }

        test('json function', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"profile":{"name":"david"}}\')')), {
            default: 'json(\'{"profile":{"name":"david"}}\')'
          });
        });

        test('nested json functions', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json_extract(json_object(\'{"profile":null}\'), "profile")')), {
            default: 'json_extract(json_object(\'{"profile":null}\'), "profile")'
          });
        });

        test('escaped string argument', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')')), {
            default: 'json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')'
          });
        });

        test('unbalnced statement', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json())'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json_extract(json()'))).to.throw();
        });

        test('separator injection', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(; DELETE YOLO INJECTIONS; -- )'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(); DELETE YOLO INJECTIONS; -- '))).to.throw();
        });
      });
    });
  });
}
