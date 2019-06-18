'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  moment = require('moment'),
  Op = require('../../../../lib/operators'),
  DataTypes = require('../../../../lib/data-types'),
  Support = require('../../support');

describe('QueryGenerator', () => {
  describe('whereItemQuery', () => {
    it('should generate correct query for Symbol operators', function() {
      const QG = Support.getAbstractQueryGenerator(this.sequelize);
      QG.whereItemQuery(Op.or, [{ test: { [Op.gt]: 5 } }, { test: { [Op.lt]: 3 } }, { test: { [Op.in]: [4] } }])
        .should.be.equal('(test > 5 OR test < 3 OR test IN (4))');

      QG.whereItemQuery(Op.and, [{ test: { [Op.between]: [2, 5] } }, { test: { [Op.ne]: 3 } }, { test: { [Op.not]: 4 } }])
        .should.be.equal('(test BETWEEN 2 AND 5 AND test != 3 AND test != 4)');

      QG.whereItemQuery(Op.or, [{ test: { [Op.is]: null } }, { testSame: { [Op.eq]: null } }])
        .should.be.equal('(test IS NULL OR testSame IS NULL)');
    });

    it('should not parse any strings as aliases operators', function() {
      const QG = Support.getAbstractQueryGenerator(this.sequelize);
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
      const QG = Support.getAbstractQueryGenerator(this.sequelize),
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
      const QG = Support.getAbstractQueryGenerator(this.sequelize);
      QG.handleSequelizeMethod(this.sequelize.where(this.sequelize.col('foo'), 'LIKE', this.sequelize.col('bar')))
        .should.be.equal('foo LIKE bar');
    });
  });

  describe('format', () => {
    it('should throw an error if passed SequelizeMethod', function() {
      const QG = Support.getAbstractQueryGenerator(this.sequelize);
      const value = this.sequelize.fn('UPPER', 'test');
      expect(() => QG.format(value)).to.throw(Error);
    });
  });

  describe('selectQuery', () => {
    it('should put the where condition in the right place on a joined table with limit (#10962)', function() {
      const dialect = Support.getTestDialect();

      const Foo = this.sequelize.define('foo', {
        id: { type: DataTypes.UUID, primaryKey: true },
        foo_prop: DataTypes.STRING
      });

      const Bar = this.sequelize.define('bar', {
        id: { type: DataTypes.UUID, primaryKey: true },
        start_time: DataTypes.DATE,
        end_time: DataTypes.DATE,
        state: { type: DataTypes.ENUM, values: ['available', 'unavailable'] }
      });

      Foo.hasMany(Bar, { as: 'bars', foreignKey: 'foo_id' });

      const queryStub = sinon.stub(this.sequelize, 'query');

      const date = moment('2019-05-27');

      return Foo.findAll({
        include: [
          {
            model: Bar,
            as: 'bars',
            required: false,
            where: {
              start_time: { [Op.lte]: date },
              end_time: { [Op.gte]: date }
            }
          }
        ],
        where: {
          [Op.or]: [
            { '$bars.state$': { [Op.in]: ['available'] } },
            { '$bars.state$': null }
          ],
          foo_prop: 'something'
        },
        limit: 10
      }).then(() => {
        const [sql] = queryStub.getCall(0).args;

        queryStub.restore();

        const expectedSql = {
          mariadb: 'SELECT `foo`.*, `bars`.`id` AS `bars.id`, `bars`.`start_time` AS `bars.start_time`, `bars`.`end_time` AS `bars.end_time`, `bars`.`state` AS `bars.state`, `bars`.`createdAt` AS `bars.createdAt`, `bars`.`updatedAt` AS `bars.updatedAt`, `bars`.`foo_id` AS `bars.foo_id` FROM (SELECT `foo`.`id`, `foo`.`foo_prop`, `foo`.`createdAt`, `foo`.`updatedAt` FROM `foos` AS `foo` WHERE `foo`.`foo_prop` = \'something\' LIMIT 10) AS `foo` LEFT OUTER JOIN `bars` AS `bars` ON `foo`.`id` = `bars`.`foo_id` AND `bars`.`start_time` <= \'2019-05-26 23:00:00.000\' AND `bars`.`end_time` >= \'2019-05-26 23:00:00.000\' WHERE (`bars.state` IN (\'available\') OR `bars.state` IS NULL);',
          mssql: 'SELECT [foo].*, [bars].[id] AS [bars.id], [bars].[start_time] AS [bars.start_time], [bars].[end_time] AS [bars.end_time], [bars].[state] AS [bars.state], [bars].[createdAt] AS [bars.createdAt], [bars].[updatedAt] AS [bars.updatedAt], [bars].[foo_id] AS [bars.foo_id] FROM (SELECT [foo].[id], [foo].[foo_prop], [foo].[createdAt], [foo].[updatedAt] FROM [foos] AS [foo] WHERE [foo].[foo_prop] = N\'something\' ORDER BY [foo].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY) AS [foo] LEFT OUTER JOIN [bars] AS [bars] ON [foo].[id] = [bars].[foo_id] AND [bars].[start_time] <= N\'2019-05-26 23:00:00.000 +00:00\' AND [bars].[end_time] >= N\'2019-05-26 23:00:00.000 +00:00\' WHERE ([bars.state] IN (N\'available\') OR [bars.state] IS NULL);',
          mysql: 'SELECT `foo`.*, `bars`.`id` AS `bars.id`, `bars`.`start_time` AS `bars.start_time`, `bars`.`end_time` AS `bars.end_time`, `bars`.`state` AS `bars.state`, `bars`.`createdAt` AS `bars.createdAt`, `bars`.`updatedAt` AS `bars.updatedAt`, `bars`.`foo_id` AS `bars.foo_id` FROM (SELECT `foo`.`id`, `foo`.`foo_prop`, `foo`.`createdAt`, `foo`.`updatedAt` FROM `foos` AS `foo` WHERE `foo`.`foo_prop` = \'something\' LIMIT 10) AS `foo` LEFT OUTER JOIN `bars` AS `bars` ON `foo`.`id` = `bars`.`foo_id` AND `bars`.`start_time` <= \'2019-05-26 23:00:00\' AND `bars`.`end_time` >= \'2019-05-26 23:00:00\' WHERE (`bars.state` IN (\'available\') OR `bars.state` IS NULL);',
          postgres: 'SELECT "foo".*, "bars"."id" AS "bars.id", "bars"."start_time" AS "bars.start_time", "bars"."end_time" AS "bars.end_time", "bars"."state" AS "bars.state", "bars"."createdAt" AS "bars.createdAt", "bars"."updatedAt" AS "bars.updatedAt", "bars"."foo_id" AS "bars.foo_id" FROM (SELECT "foo"."id", "foo"."foo_prop", "foo"."createdAt", "foo"."updatedAt" FROM "foos" AS "foo" WHERE "foo"."foo_prop" = \'something\' LIMIT 10) AS "foo" LEFT OUTER JOIN "bars" AS "bars" ON "foo"."id" = "bars"."foo_id" AND "bars"."start_time" <= \'2019-05-26 23:00:00.000 +00:00\' AND "bars"."end_time" >= \'2019-05-26 23:00:00.000 +00:00\' WHERE ("bars.state" IN (\'available\') OR "bars.state" IS NULL);',
          'postgres-native': 'SELECT "foo".*, "bars"."id" AS "bars.id", "bars"."start_time" AS "bars.start_time", "bars"."end_time" AS "bars.end_time", "bars"."state" AS "bars.state", "bars"."createdAt" AS "bars.createdAt", "bars"."updatedAt" AS "bars.updatedAt", "bars"."foo_id" AS "bars.foo_id" FROM (SELECT "foo"."id", "foo"."foo_prop", "foo"."createdAt", "foo"."updatedAt" FROM "foos" AS "foo" WHERE "foo"."foo_prop" = \'something\' LIMIT 10) AS "foo" LEFT OUTER JOIN "bars" AS "bars" ON "foo"."id" = "bars"."foo_id" AND "bars"."start_time" <= \'2019-05-26 23:00:00.000 +00:00\' AND "bars"."end_time" >= \'2019-05-26 23:00:00.000 +00:00\' WHERE ("bars.state" IN (\'available\') OR "bars.state" IS NULL);',
          sqlite: 'SELECT `foo`.*, `bars`.`id` AS `bars.id`, `bars`.`start_time` AS `bars.start_time`, `bars`.`end_time` AS `bars.end_time`, `bars`.`state` AS `bars.state`, `bars`.`createdAt` AS `bars.createdAt`, `bars`.`updatedAt` AS `bars.updatedAt`, `bars`.`foo_id` AS `bars.foo_id` FROM (SELECT `foo`.`id`, `foo`.`foo_prop`, `foo`.`createdAt`, `foo`.`updatedAt` FROM `foos` AS `foo` WHERE `foo`.`foo_prop` = \'something\' LIMIT 10) AS `foo` LEFT OUTER JOIN `bars` AS `bars` ON `foo`.`id` = `bars`.`foo_id` AND `bars`.`start_time` <= \'2019-05-26 23:00:00.000 +00:00\' AND `bars`.`end_time` >= \'2019-05-26 23:00:00.000 +00:00\' WHERE (`bars.state` IN (\'available\') OR `bars.state` IS NULL);'
        };

        if (!expectedSql[dialect]) {
          throw new Error(`Expected value for ${dialect} not defined`);
        }

        expect(sql).to.equal(expectedSql[dialect]);
      });
    });
  });
});
