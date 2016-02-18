'use strict';

var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator
  , current = Support.sequelize;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

if (current.dialect.supports.JSON) {
  suite(Support.getTestDialectTeaser('SQL'), function() {
    suite('JSON', function () {
      suite('escape', function () {
        test('plain string', function () {
          expectsql(sql.escape('string', { type: new DataTypes.JSON() }), {
            default: '\'"string"\''
          });
        });

        test('plain int', function () {
          expectsql(sql.escape(0, { type: new DataTypes.JSON() }), {
            default: '\'0\''
          });
          expectsql(sql.escape(123, { type: new DataTypes.JSON() }), {
            default: '\'123\''
          });
        });

        test('boolean', function () {
          expectsql(sql.escape(true, { type: new DataTypes.JSON() }), {
            default: '\'true\''
          });
          expectsql(sql.escape(false, { type: new DataTypes.JSON() }), {
            default: '\'false\''
          });
        });

        test('NULL', function () {
          expectsql(sql.escape(null, { type: new DataTypes.JSON() }), {
            default: 'NULL'
          });
        });

        test('nested object', function () {
          expectsql(sql.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: new DataTypes.JSON() }), {
            default: '\'{"some":"nested","more":{"nested":true},"answer":42}\''
          });
        });

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
      });
    });
  });
}
