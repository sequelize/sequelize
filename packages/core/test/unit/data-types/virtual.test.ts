import sinon from 'sinon';
import { DataTypes, literal } from '@sequelize/core';
import { expectsql, getTestDialect, sequelize } from '../../support';

describe('DataTypes.VIRTUAL', () => {
  describe('includeAsSyntax', () => {
    const dialectName = getTestDialect();

    let stub: sinon.SinonStub;
    beforeEach(() => {
      stub = sinon.stub(sequelize, 'queryRaw');
    });

    afterEach(() => {
      stub.restore();
    });

    it('should allow a literal as VIRTUAL', async () => {
      const User = sequelize.define('User', {
        active: DataTypes.VIRTUAL(DataTypes.BOOLEAN, includeAs => [
        dialectName === 'db2'
        ? literal(`(SELECT "createdAt" > CURRENT DATE - 7 DAYS FROM "Users" WHERE "User"."id" = "${includeAs.replace(/`/g, '')}"."id")`)
        : dialectName === 'sqlite' ? literal(`(SELECT "createdAt" > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE "User"."id" = ${includeAs}."id")`)
        : dialectName === 'postgres' ? literal(`(SELECT "createdAt" > NOW() - INTERVAL '1 week' FROM "Users" WHERE "User"."id" = "${includeAs.replace(/`/g, '')}"."id")`)
        : dialectName === 'mssql' ? literal(`(SELECT COUNT(*) FROM Users WHERE Users.id = ${includeAs.replace(/`/g, '')}.id AND createdAt > DATEADD(WEEK, -1, GETDATE()))`)
        : literal(`(SELECT createdAt > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE User.id = ${includeAs}.id)`),
        'active',
        ]),
      });

      await User.findAll({
        attributes: ['active'],
      });

      const sql = stub.getCall(0).args[0] as string;

      expectsql(sql, {
        postgres: `SELECT /* start Users.active */ (SELECT "createdAt" > NOW() - INTERVAL '1 week' FROM "Users" WHERE "User"."id" = "Users"."id") /* end Users.active */ AS "active" FROM "Users" AS "User";`,
        mysql: 'SELECT /* start Users.active */ (SELECT createdAt > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE User.id = `Users`.id) /* end Users.active */ AS `active` FROM `Users` AS `User`;',
        mariadb: 'SELECT /* start Users.active */ (SELECT createdAt > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE User.id = `Users`.id) /* end Users.active */ AS `active` FROM `Users` AS `User`;',
        sqlite: 'SELECT /* start Users.active */ (SELECT "createdAt" > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE "User"."id" = `Users`."id") /* end Users.active */ AS `active` FROM `Users` AS `User`;',
        snowflake: 'SELECT /* start Users.active */ (SELECT createdAt > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE User.id = `Users`.id) /* end Users.active */ AS "active" FROM "Users" AS "User";',
        db2: 'SELECT /* start Users.active */ (SELECT "createdAt" > CURRENT DATE - 7 DAYS FROM "Users" WHERE "User"."id" = "Users"."id") /* end Users.active */ AS `active` FROM `Users` AS `User`;',
        ibmi: 'SELECT /* start Users.active */ (SELECT createdAt > CURRENT_DATE - 7 * 24 * 60 * 60 * 1000 FROM Users WHERE User.id = `Users`.id) /* end Users.active */ AS "active" FROM "Users" AS "User"',
        mssql: 'SELECT /* start Users.active */ (SELECT COUNT(*) FROM Users WHERE Users.id = Users.id AND createdAt > DATEADD(WEEK, -1, GETDATE())) /* end Users.active */ AS [active] FROM [Users] AS [User];',
      });
    });
  });
});
