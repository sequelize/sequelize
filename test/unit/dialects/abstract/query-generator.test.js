'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Op = require('../../../../lib/operators'),
  getAbstractQueryGenerator = require('../../support').getAbstractQueryGenerator;

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
  });

  describe('format', () => {
    it('should throw an error if passed SequelizeMethod', function() {
      const QG = getAbstractQueryGenerator(this.sequelize);
      const value = this.sequelize.fn('UPPER', 'test');
      expect(() => QG.format(value)).to.throw(Error);
    });
  });
});

