'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Op = require('../../../../lib/operators'),
  Support = require('../../support'),
  getAbstractQueryGenerator = Support.getAbstractQueryGenerator,
  expectsql = Support.expectsql;
const AbstractQueryGenerator = require('sequelize/lib/dialects/abstract/query-generator');

describe('QueryGenerator', () => {
  describe('whereItemQuery', () => {
    it('should generate correct query for Symbol operators', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      QG.whereItemQuery(Op.or, [{ test: { [Op.gt]: 5 } }, { test: { [Op.lt]: 3 } }, { test: { [Op.in]: [4] } }])
        .should.be.equal('(test > 5 OR test < 3 OR test IN (4))');

      QG.whereItemQuery(Op.and, [{ test: { [Op.between]: [2, 5] } }, { test: { [Op.ne]: 3 } }, { test: { [Op.not]: 4 } }])
        .should.be.equal('(test BETWEEN 2 AND 5 AND test != 3 AND test != 4)');

      QG.whereItemQuery(Op.or, [{ test: { [Op.is]: null } }, { testSame: { [Op.eq]: null } }])
        .should.be.equal('(test IS NULL OR testSame IS NULL)');
    });

    it('should not parse any strings as aliases operators', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      expect(() => QG.whereItemQuery('$or', [{ test: 5 }, { test: 3 }]))
        .to.throw('Invalid value { test: 5 }');

      expect(() => QG.whereItemQuery('$and', [{ test: 5 }, { test: 3 }]))
        .to.throw('Invalid value { test: 5 }');

      expect(() => QG.whereItemQuery('test', { $gt: 5 }))
        .to.throw('Invalid value { \'$gt\': 5 }');

      expect(() => QG.whereItemQuery('test', { $between: [2, 5] }))
        .to.throw('Invalid value { \'$between\': [ 2, 5 ] }');

      expect(() => QG.whereItemQuery('test', { $ne: 3 }))
        .to.throw('Invalid value { \'$ne\': 3 }');

      expect(() => QG.whereItemQuery('test', { $not: 3 }))
        .to.throw('Invalid value { \'$not\': 3 }');

      expect(() => QG.whereItemQuery('test', { $in: [4] }))
        .to.throw('Invalid value { \'$in\': [ 4 ] }');

      // simulate transaction passed into where query argument
      class Sequelize {
        constructor() {
          this.config = {
            password: 'password'
          };
        }
      }

      class Transaction {
        constructor() {
          this.sequelize = new Sequelize();
        }
      }

      expect(() => QG.whereItemQuery('test', new Transaction())).to.throw(
        'Invalid value Transaction { sequelize: Sequelize { config: [Object] } }'
      );
    });

    it('should parse set aliases strings as operators', function() {
      const QG = getAbstractQueryGenerator(this.sequelize),
        aliases = {
          OR: Op.or,
          '!': Op.not,
          '^^': Op.gt
        };

      QG.setOperatorsAliases(aliases);

      QG.whereItemQuery('OR', [{ test: { '^^': 5 } }, { test: { '!': 3 } }, { test: { [Op.in]: [4] } }])
        .should.be.equal('(test > 5 OR test != 3 OR test IN (4))');

      QG.whereItemQuery(Op.and, [{ test: { [Op.between]: [2, 5] } }, { test: { '!': 3 } }, { test: { '^^': 4 } }])
        .should.be.equal('(test BETWEEN 2 AND 5 AND test != 3 AND test > 4)');

      expect(() => QG.whereItemQuery('OR', [{ test: { '^^': 5 } }, { test: { $not: 3 } }, { test: { [Op.in]: [4] } }]))
        .to.throw('Invalid value { \'$not\': 3 }');

      expect(() => QG.whereItemQuery('OR', [{ test: { $gt: 5 } }, { test: { '!': 3 } }, { test: { [Op.in]: [4] } }]))
        .to.throw('Invalid value { \'$gt\': 5 }');

      expect(() => QG.whereItemQuery('$or', [{ test: 5 }, { test: 3 }]))
        .to.throw('Invalid value { test: 5 }');

      expect(() => QG.whereItemQuery('$and', [{ test: 5 }, { test: 3 }]))
        .to.throw('Invalid value { test: 5 }');

      expect(() => QG.whereItemQuery('test', { $gt: 5 }))
        .to.throw('Invalid value { \'$gt\': 5 }');

      expect(() => QG.whereItemQuery('test', { $between: [2, 5] }))
        .to.throw('Invalid value { \'$between\': [ 2, 5 ] }');

      expect(() => QG.whereItemQuery('test', { $ne: 3 }))
        .to.throw('Invalid value { \'$ne\': 3 }');

      expect(() => QG.whereItemQuery('test', { $not: 3 }))
        .to.throw('Invalid value { \'$not\': 3 }');

      expect(() => QG.whereItemQuery('test', { $in: [4] }))
        .to.throw('Invalid value { \'$in\': [ 4 ] }');
    });

    it('should correctly parse sequelize.where with .fn as logic', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      QG.handleSequelizeMethod(this.sequelize.where(this.sequelize.col('foo'), 'LIKE', this.sequelize.col('bar')))
        .should.be.equal('foo LIKE bar');

      QG.handleSequelizeMethod(this.sequelize.where(this.sequelize.col('foo'), Op.ne, null))
        .should.be.equal('foo IS NOT NULL');

      QG.handleSequelizeMethod(this.sequelize.where(this.sequelize.col('foo'), Op.not, null))
        .should.be.equal('foo IS NOT NULL');
    });

    it('should correctly escape a single $ in sequelize.fn arguments', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      const value = QG.handleSequelizeMethod(this.sequelize.fn('upper', '$user'));
      expectsql(value, {
        mssql: "upper(N'$$user')",
        default: "upper('$$user')"
      });
    });

    it('should correctly escape multiple instances of "$" in sequelize.fn arguments', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      const value = QG.handleSequelizeMethod(this.sequelize.fn('upper', '$user and then another $user and some dollars: $42.69'));
      expectsql(value, {
        mssql: 'upper(N\'$$user and then another $$user and some dollars: $$42.69\')',
        default: 'upper(\'$$user and then another $$user and some dollars: $$42.69\')'
      });
    });
  });

  describe('format', () => {
    it('should throw an error if passed SequelizeMethod', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      const value = this.sequelize.fn('UPPER', 'test');
      expect(() => QG.format(value)).to.throw(Error);
    });
  });

  describe('jsonPathExtractionQuery', () => {
    const expectQueryGenerator = (query, assertions) => {
      const expectation = assertions[Support.sequelize.dialect.name];
      if (!expectation) {
        throw new Error(`Undefined expectation for "${Support.sequelize.dialect.name}"!`);
      }
      return expectation(query);
    };

    it('should handle isJson parameter true', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      expectQueryGenerator(() => QG.jsonPathExtractionQuery('profile', 'id', true), {
        postgres: query => expect(query()).to.equal('(profile#>\'{id}\')'),
        sqlite: query => expect(query()).to.equal('json_extract(profile,\'$.id\')'),
        mariadb: query => expect(query()).to.equal('json_unquote(json_extract(profile,\'$.id\'))'),
        mysql: query => expect(query()).to.equal("json_unquote(json_extract(profile,'$.\\\"id\\\"'))"),
        mssql: query => expect(query).to.throw(Error),
        snowflake: query => expect(query).to.throw(Error),
        oracle: query => expect(query).to.throw(Error),
        db2: query => expect(query).to.throw(Error)
      });
    });

    it('should use default handling if isJson is false', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      expectQueryGenerator(() => QG.jsonPathExtractionQuery('profile', 'id', false), {
        postgres: query => expect(query()).to.equal('(profile#>>\'{id}\')'),
        sqlite: query => expect(query()).to.equal('json_extract(profile,\'$.id\')'),
        mariadb: query => expect(query()).to.equal('json_unquote(json_extract(profile,\'$.id\'))'),
        mysql: query => expect(query()).to.equal("json_unquote(json_extract(profile,'$.\\\"id\\\"'))"),
        mssql: query => expect(query).to.throw(Error),
        snowflake: query => expect(query).to.throw(Error),
        oracle: query => expect(query).to.throw(Error),
        db2: query => expect(query).to.throw(Error)
      });
    });

    it('Should use default handling if isJson is not passed', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      expectQueryGenerator(() => QG.jsonPathExtractionQuery('profile', 'id'), {
        postgres: query => expect(query()).to.equal('(profile#>>\'{id}\')'),
        sqlite: query => expect(query()).to.equal('json_extract(profile,\'$.id\')'),
        mariadb: query => expect(query()).to.equal('json_unquote(json_extract(profile,\'$.id\'))'),
        mysql: query => expect(query()).to.equal("json_unquote(json_extract(profile,'$.\\\"id\\\"'))"),
        mssql: query => expect(query).to.throw(Error),
        snowflake: query => expect(query).to.throw(Error),
        oracle: query => expect(query).to.throw(Error),
        db2: query => expect(query).to.throw(Error)
      });
    });
  });

  describe('queryIdentifier', () => {
    it('should throw an error if call base quoteIdentifier', function() {
      const QG = new AbstractQueryGenerator({ sequelize: this.sequelize, _dialect: this.sequelize.dialect });
      expect(() => QG.quoteIdentifier('test', true))
        .to.throw(`quoteIdentifier for Dialect "${this.sequelize.dialect.name}" is not implemented`);
    });
  });
});
