'use strict';

const Support = require('../support'),
  util = require('util'),
  _ = require('lodash'),
  chai = require('chai'),
  expect = chai.expect,
  Sequelize = Support.Sequelize,
  expectsql = Support.expectsql,
  current = Support.sequelize,
  QG = current.dialect.QueryGenerator;

const {
  Composition,
  Placeholder
} = require('../../../lib/dialects/abstract/query-generator/composition');

describe('Composed queries', () => {
  const testsql = function(arg, expectation) {
    it(util.inspect(arg, { depth: 3 }), () => {
      const sqlOrError = _.attempt(() => QG.composeQuery(QG.handleSequelizeMethod(arg)), arg);
      return expectsql(sqlOrError, expectation);
    });
  };

  describe('process value slots with data types', () => {
    testsql(current.composition('SELECT ', current.slot(5, Sequelize.INTEGER), ', ', current.slot(new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), Sequelize.DATE)), {
      query: {
        default: 'SELECT $1, $2;'
      },
      bind: {
        default: [5, '2011-03-27 10:01:55.000 +00:00'],
        mysql: [5, '2011-03-27 10:01:55'],
        mariadb: [5, '2011-03-27 10:01:55.000']
      }
    });
  });

  describe('composeQuery method disallows unreplaced placeholders', () => {
    testsql(current.composition('SELECT ', current.slot(5, Sequelize.INTEGER), ', ', current.placeholder()), {
      default: new Error('Query item is not a slot or a string:\nPlaceholder { name: undefined }')
    });
  });

  describe('composeString method disallows unreplaced placeholders', () => {
    expect(() => QG.composeString(new Composition('SELECT ', QG.handleSequelizeMethod(current.placeholder())))).to.throw('Query item is not a slot or a string:\nPlaceholder { name: undefined }');
  });

  describe('handle Slot as a sequelize method', () => {
    testsql(current.slot(5, Sequelize.INTEGER), {
      query: {
        default: '$1;'
      },
      bind: {
        default: [5]
      }
    });
  });

  it('handle placeholder as a sequelize method', () => {
    const result = QG.handleSequelizeMethod(current.placeholder());
    expect(result).to.be.instanceof(Composition);
    expect(result.items[0]).to.be.instanceof(Placeholder);
  });
});
