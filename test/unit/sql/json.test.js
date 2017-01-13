'use strict';

var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator
  , current = Support.sequelize;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
if (current.dialect.supports.JSON) {
  const type = DataTypes[current.dialect.name].JSON ?
    new DataTypes[current.dialect.name].JSON() :
    new DataTypes.JSON();

  suite(Support.getTestDialectTeaser('SQL'), function() {
    suite('JSON', function () {
      suite('escape', function () {
        test('plain string', function () {
          expectsql(sql.escape('string', { type: type }), {
            default: '\'"string"\'',
            mysql: '\'\\"string\\"\''
          });
        });

        test('plain int', function () {
          expectsql(sql.escape(0, { type: type }), {
            default: '\'0\''
          });
          expectsql(sql.escape(123, { type: type }), {
            default: '\'123\''
          });
        });

        test('boolean', function () {
          expectsql(sql.escape(true, { type: type }), {
            default: '\'true\''
          });
          expectsql(sql.escape(false, { type: type }), {
            default: '\'false\''
          });
        });

        test('NULL', function () {
          expectsql(sql.escape(null, { type: type }), {
            default: 'NULL'
          });
        });

        test('nested object', function () {
          expectsql(sql.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: type }), {
            default: '\'{"some":"nested","more":{"nested":true},"answer":42}\'',
            mysql: '\'{\\"some\\":\\"nested\\",\\"more\\":{\\"nested\\":true},\\"answer\\":42}\''
          });
        });

        if (current.dialect.name === 'postgres') {
          test('array of JSON', function () {
            expectsql(sql.escape([
              { some: 'nested', more: { nested: true }, answer: 42 },
              43,
              'joe'
            ], { type: DataTypes.ARRAY(DataTypes.JSON)}), {
              postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSON[]'
            });
          });
          test('array of JSONB', function () {
            expectsql(sql.escape([
              { some: 'nested', more: { nested: true }, answer: 42 },
              43,
              'joe'
            ], { type: DataTypes.ARRAY(DataTypes.JSONB)}), {
              postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSONB[]'
            });
          });
        }
      });
    });
  });
}
