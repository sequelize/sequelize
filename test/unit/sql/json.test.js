'use strict';

const Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  expect = require('chai').expect,
  expectsql = Support.expectsql,
  Sequelize = Support.Sequelize,
  current = Support.sequelize,
  sql = current.dialect.queryGenerator;

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
        it('condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ id: 1 })), {
            postgres: '("id"#>>\'{}\') = \'1\'',
            sqlite: "json_extract(`id`,'$') = '1'",
            mariadb: "json_unquote(json_extract(`id`,'$')) = '1'",
            oracle: 'json_value("id",\'$\') = \'1\'',
            mysql: "json_unquote(json_extract(`id`,'$')) = '1'"
          });
        });

        it('nested condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ profile: { id: 1 } })), {
            postgres: '("profile"#>>\'{id}\') = \'1\'',
            sqlite: "json_extract(`profile`,'$.id') = '1'",
            mariadb: "json_unquote(json_extract(`profile`,'$.id')) = '1'",
            oracle: 'json_value("profile",\'$."id"\') = \'1\'',
            mysql: "json_unquote(json_extract(`profile`,'$.\\\"id\\\"')) = '1'"
          });
        });

        it('multiple condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ property: { value: 1 }, another: { value: 'string' } })), {
            postgres: '("property"#>>\'{value}\') = \'1\' AND ("another"#>>\'{value}\') = \'string\'',
            sqlite: "json_extract(`property`,'$.value') = '1' AND json_extract(`another`,'$.value') = 'string'",
            mariadb: "json_unquote(json_extract(`property`,'$.value')) = '1' AND json_unquote(json_extract(`another`,'$.value')) = 'string'",
            oracle: 'json_value("property",\'$."value"\') = \'1\' AND json_value("another",\'$."value"\') = \'string\'',
            mysql: "json_unquote(json_extract(`property`,'$.\\\"value\\\"')) = '1' AND json_unquote(json_extract(`another`,'$.\\\"value\\\"')) = 'string'"
          });
        });

        it('property array object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ property: [[4, 6], [8]] })), {
            postgres: '("property"#>>\'{0,0}\') = \'4\' AND ("property"#>>\'{0,1}\') = \'6\' AND ("property"#>>\'{1,0}\') = \'8\'',
            sqlite: "json_extract(`property`,'$[0][0]') = '4' AND json_extract(`property`,'$[0][1]') = '6' AND json_extract(`property`,'$[1][0]') = '8'",
            mariadb: "json_unquote(json_extract(`property`,'$[0][0]')) = '4' AND json_unquote(json_extract(`property`,'$[0][1]')) = '6' AND json_unquote(json_extract(`property`,'$[1][0]')) = '8'",
            oracle: 'json_value("property",\'$[0][0]\') = \'4\' AND json_value("property",\'$[0][1]\') = \'6\' AND json_value("property",\'$[1][0]\') = \'8\'',
            mysql: "json_unquote(json_extract(`property`,'$[0][0]')) = '4' AND json_unquote(json_extract(`property`,'$[0][1]')) = '6' AND json_unquote(json_extract(`property`,'$[1][0]')) = '8'"
          });
        });

        it('dot notation', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('profile.id'), '1'), {
            postgres: '("profile"#>>\'{id}\') = \'1\'',
            sqlite: "json_extract(`profile`,'$.id') = '1'",
            mariadb: "json_unquote(json_extract(`profile`,'$.id')) = '1'",
            oracle: 'json_value("profile",\'$."id"\') = \'1\'',
            mysql: "json_unquote(json_extract(`profile`,'$.\\\"id\\\"')) = '1'"
          });
        });

        it('item dot notation array', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('profile.id.0.1'), '1'), {
            postgres: '("profile"#>>\'{id,0,1}\') = \'1\'',
            sqlite: "json_extract(`profile`,'$.id[0][1]') = '1'",
            mariadb: "json_unquote(json_extract(`profile`,'$.id[0][1]')) = '1'",
            oracle: 'json_value("profile",\'$."id"[0][1]\') = \'1\'',
            mysql: "json_unquote(json_extract(`profile`,'$.\\\"id\\\"[0][1]')) = '1'"
          });
        });

        it('column named "json"', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('json'), '{}'), {
            postgres: '("json"#>>\'{}\') = \'{}\'',
            sqlite: "json_extract(`json`,'$') = '{}'",
            mariadb: "json_unquote(json_extract(`json`,'$')) = '{}'",
            oracle: 'json_value("json",\'$\') = \'{}\'',
            mysql: "json_unquote(json_extract(`json`,'$')) = '{}'"
          });
        });
      });

      describe('raw json query', () => {
        if (current.dialect.name === 'postgres') {
          it('#>> operator', () => {
            expectsql(sql.whereItemQuery(Sequelize.json('("data"#>>\'{id}\')'), 'id'), {
              postgres: '("data"#>>\'{id}\') = \'id\''
            });
          });
        }

        it('json function', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"profile":{"name":"david"}}\')')), {
            default: 'json(\'{"profile":{"name":"david"}}\')'
          });
        });

        it('nested json functions', () => {
          const rawJSON = current.dialect.name === 'oracle' ? 'json_value(json_object(\'{"profile":null}\'), "profile")' : 'json_extract(json_object(\'{"profile":null}\'), "profile")';
          expectsql(sql.handleSequelizeMethod(Sequelize.json(rawJSON)), {
            oracle: 'json_value(json_object(\'{"profile":null}\'), "profile")',
            default: 'json_extract(json_object(\'{"profile":null}\'), "profile")'
          });
        });

        it('escaped string argument', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')')), {
            default: 'json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')'
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
