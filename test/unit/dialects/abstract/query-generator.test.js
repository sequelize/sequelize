'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Op = require('../../../../lib/operators'),
  util = require('util'),
  _ = require('lodash'),
  Support = require('../../support'),
  current = Support.sequelize,
  QG = Support.getAbstractQueryGenerator(current);

describe('QueryGenerator', () => {
  describe('whereItemQuery', () => {
    const testsql = function(key, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      it(`${String(key)}: ${util.inspect(value, { depth: 10 })}${options && `, ${util.inspect(options)}` || ''}`, () => {
        const sqlOrError = _.attempt(() =>
          QG.composeQuery.call(QG, QG.whereItemQuery.apply(QG, arguments)),
        key, value, options);

        if (sqlOrError instanceof Error) {
          expect(sqlOrError.message).to.equal(expectation.message);
        } else {
          expect(sqlOrError).to.deep.equal(expectation);
        }
      });
    };

    describe('should generate correct query for Symbol operators', () => {
      testsql(Op.or,
        [{ test: { [Op.gt]: 5 } }, { test: { [Op.lt]: 3 } }, { test: { [Op.in]: [4] } }],
        {
          query: '("test" > $1 OR "test" < $2 OR "test" IN ($3));',
          bind: [5, 3, 4]
        });

      testsql(Op.and,
        [{ test: { [Op.between]: [2, 5] } }, { test: { [Op.ne]: 3 } }, { test: { [Op.not]: 4 } }],
        {
          query: '("test" BETWEEN $1 AND $2 AND "test" != $3 AND "test" != $4);',
          bind: [2, 5, 3, 4]
        });

      testsql(Op.or,
        [{ test: { [Op.is]: null } }, { testSame: { [Op.eq]: null } }],
        {
          query: '("test" IS NULL OR "testSame" IS NULL);',
          bind: []
        });

    });

    describe('should not parse any strings as aliases operators', () => {
      // The names should be quoted, but abstract QG does not have mehtod quoteIdentifier()
      testsql('$or', [{ test: 5 }, { test: 3 }], {
        query: '"$or" IN ($1, $2);',
        bind: [{ test: 5 }, { test: 3 }]
      });

      testsql('$and', [{ test: 5 }, { test: 3 }], {
        query: '"$and" IN ($1, $2);',
        bind: [{ test: 5 }, { test: 3 }]
      });

      testsql('test', { $gt: 5 }, {
        query: '"test" = $1;',
        bind: [{ $gt: 5 }]
      });

      testsql('test', { $between: [2, 5] }, {
        query: '"test" = $1;',
        bind: [{ $between: [2, 5] }]
      });

      testsql('test', { $ne: 3 }, {
        query: '"test" = $1;',
        bind: [{ $ne: 3 }]
      });

      testsql('test', { $not: 3 }, {
        query: '"test" = $1;',
        bind: [{ $not: 3 }]
      });

      testsql('test', { $in: [4] }, {
        query: '"test" = $1;',
        bind: [{ $in: [4] }]
      });
    });

    describe('should parse set aliases strings as operators', () => {
      const aliases = {
        OR: Op.or,
        '!': Op.not,
        '^^': Op.gt
      };

      QG.setOperatorsAliases(aliases);

      testsql('OR', [{ test: { '^^': 5 } }, { test: { '!': 3 } }, { test: { [Op.in]: [4] } }], {
        query: '("test" > $1 OR "test" != $2 OR "test" IN ($3));',
        bind: [5, 3, 4]
      });

      testsql(Op.and,
        [{ test: { [Op.between]: [2, 5] } }, { test: { '!': 3 } }, { test: { '^^': 4 } }], {
          query: '("test" BETWEEN $1 AND $2 AND "test" != $3 AND "test" > $4);',
          bind: [2, 5, 3, 4]
        });

      testsql('OR', [{ test: { '^^': 5 } }, { test: { $not: 3 } }, { test: { [Op.in]: [4] } }], {
        query: '("test" > $1 OR "test" = $2 OR "test" IN ($3));',
        bind: [5, { $not: 3 }, 4]
      });

      testsql('OR', [{ test: { $gt: 5 } }, { test: { '!': 3 } }, { test: { [Op.in]: [4] } }], {
        query: '("test" = $1 OR "test" != $2 OR "test" IN ($3));',
        bind: [{ $gt: 5 }, 3, 4]
      });

      testsql('$or', [{ test: 5 }, { test: 3 }], {
        query: '"$or" IN ($1, $2);',
        bind: [{ test: 5 }, { test: 3 }]
      });

      testsql('$and', [{ test: 5 }, { test: 3 }], {
        query: '"$and" IN ($1, $2);',
        bind: [{ test: 5 }, { test: 3 }]
      });

      testsql('test', { $gt: 5 }, {
        query: '"test" = $1;',
        bind: [{ $gt: 5 }]
      });

      testsql('test', { $between: [2, 5] }, {
        query: '"test" = $1;',
        bind: [{ $between: [2, 5] }]
      });

      testsql('test', { $ne: 3 }, {
        query: '"test" = $1;',
        bind: [{ $ne: 3 }]
      });

      testsql('test', { $not: 3 }, {
        query: '"test" = $1;',
        bind: [{ $not: 3 }]
      });

      testsql('test', { $in: [4] }, {
        query: '"test" = $1;',
        bind: [{ $in: [4] }]
      });
    });

    it('should correctly parse sequelize.where with .fn as logic', function() {
      const items = QG.handleSequelizeMethod(current.where(current.col('foo'), 'LIKE', this.sequelize.col('bar')));
      QG.composeQuery(items).query.should.be.equal('"foo" LIKE "bar";');
    });
  });

  describe('format', () => {
    it('should throw an error if passed SequelizeMethod', function() {
      const value = this.sequelize.fn('UPPER', 'test');
      expect(() => QG.format(value)).to.throw(Error);
    });
  });
});

