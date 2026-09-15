'use strict';

const chai = require('chai');
const times = require('lodash/times');

const expect = chai.expect;
const sinon = require('sinon');
const Support = require('../../support');

const { DataTypes, Op, sql } = require('@sequelize/core');

const dialect = Support.getTestDialect();

if (dialect.startsWith('mssql')) {
  describe(Support.getTestDialectTeaser('Regressions'), () => {
    it('does not duplicate columns in ORDER BY statement, #9008', async function () {
      const LoginLog = this.sequelize.define('LoginLog', {
        ID: {
          field: 'id',
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        UserID: {
          field: 'userid',
          type: DataTypes.UUID,
          allowNull: false,
        },
      });

      const User = this.sequelize.define('User', {
        UserID: {
          field: 'userid',
          type: DataTypes.UUID,
          defaultValue: sql.uuidV4,
          primaryKey: true,
        },
        UserName: {
          field: 'username',
          type: DataTypes.STRING(50),
          allowNull: false,
        },
      });

      LoginLog.belongsTo(User, {
        foreignKey: 'UserID',
      });
      User.hasMany(LoginLog, {
        foreignKey: 'UserID',
      });

      await this.sequelize.sync({ force: true });

      const vyom = await User.create({ UserName: 'Vayom' });
      const shakti = await User.create({ UserName: 'Shaktimaan' });
      const nikita = await User.create({ UserName: 'Nikita' });
      const arya = await User.create({ UserName: 'Aryamaan' });

      await vyom.createLoginLog();
      await shakti.createLoginLog();
      await nikita.createLoginLog();
      await arya.createLoginLog();

      const logs = await LoginLog.findAll({
        include: [
          {
            model: User,
            where: {
              UserName: {
                [Op.like]: '%maan%',
              },
            },
          },
        ],
        order: [[User, 'UserName', 'DESC']],
        offset: 0,
        limit: 10,
      });

      expect(logs).to.have.length(2);
      expect(logs[0].user.get('UserName')).to.equal('Shaktimaan');
      expect(logs[1].user.get('UserName')).to.equal('Aryamaan');

      // #11258 and similar
      const otherLogs = await LoginLog.findAll({
        include: [
          {
            model: User,
            where: {
              UserName: {
                [Op.like]: '%maan%',
              },
            },
          },
        ],
        order: [['id', 'DESC']],
        offset: 0,
        limit: 10,
      });

      expect(otherLogs).to.have.length(2);
      expect(otherLogs[0].user.get('UserName')).to.equal('Aryamaan');
      expect(otherLogs[1].user.get('UserName')).to.equal('Shaktimaan');

      // Separate queries can apply order freely
      const separateUsers = await User.findAll({
        include: [
          {
            model: LoginLog,
            separate: true,
            order: ['id'],
          },
        ],
        where: {
          UserName: {
            [Op.like]: '%maan%',
          },
        },
        order: ['UserName', ['UserID', 'DESC']],
        offset: 0,
        limit: 10,
      });

      expect(separateUsers).to.have.length(2);
      expect(separateUsers[0].get('UserName')).to.equal('Aryamaan');
      expect(separateUsers[0].get('loginLogs')).to.have.length(1);
      expect(separateUsers[1].get('UserName')).to.equal('Shaktimaan');
      expect(separateUsers[1].get('loginLogs')).to.have.length(1);
    });

    it('allow referencing FK to different tables in a schema with onDelete, #10125', async function () {
      const Child = this.sequelize.define(
        'Child',
        {},
        {
          timestamps: false,
          freezeTableName: true,
          schema: 'a',
        },
      );
      const Toys = this.sequelize.define(
        'Toys',
        {},
        {
          timestamps: false,
          freezeTableName: true,
          schema: 'a',
        },
      );
      const Parent = this.sequelize.define(
        'Parent',
        {},
        {
          timestamps: false,
          freezeTableName: true,
          schema: 'a',
        },
      );

      Child.hasOne(Toys, {
        foreignKey: { onDelete: 'CASCADE' },
      });

      Parent.hasOne(Toys, {
        foreignKey: { onDelete: 'CASCADE' },
      });

      const spy = sinon.spy();

      await this.sequelize.queryInterface.createSchema('a');
      await this.sequelize.sync({
        force: true,
        logging: spy,
      });

      expect(spy).to.have.been.called;
      const log = spy.args.find(arg =>
        arg[0].includes(`IF OBJECT_ID(N'[a].[Toys]', 'U') IS NULL CREATE TABLE`),
      )[0];

      expect(log.match(/ON DELETE CASCADE/g).length).to.equal(2);
    });

    it('sets the varchar(max) length correctly on describeTable', async function () {
      const Users = this.sequelize.define(
        '_Users',
        {
          username: DataTypes.STRING('MAX'),
        },
        { freezeTableName: true },
      );

      await Users.sync({ force: true });
      const metadata = await this.sequelize.queryInterface.describeTable('_Users');
      const username = metadata.username;
      expect(username.type).to.include('(MAX)');
    });

    it('sets the char(10) length correctly on describeTable', async function () {
      const Users = this.sequelize.define(
        '_Users',
        {
          username: DataTypes.CHAR(10),
        },
        { freezeTableName: true },
      );

      await Users.sync({ force: true });
      const metadata = await this.sequelize.queryInterface.describeTable('_Users');
      const username = metadata.username;
      expect(username.type).to.include('(10)');
    });

    it('saves value bigger than 2147483647, #11245', async function () {
      const BigIntTable = this.sequelize.define(
        'BigIntTable',
        {
          business_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
          },
        },
        {
          freezeTableName: true,
        },
      );

      const bigIntValue = 2_147_483_648;

      await BigIntTable.sync({ force: true });

      await BigIntTable.create({
        business_id: bigIntValue,
      });

      const record = await BigIntTable.findOne();
      expect(Number(record.business_id)).to.equals(bigIntValue);
    });

    it('saves boolean is true, #12090', async function () {
      const BooleanTable = this.sequelize.define(
        'BooleanTable',
        {
          status: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
          },
        },
        {
          freezeTableName: true,
        },
      );

      const value = true;

      await BooleanTable.sync({ force: true });

      await BooleanTable.create({
        status: value,
      });

      const record = await BooleanTable.findOne();
      expect(record.status).to.equals(value);
    });

    // Fixes https://github.com/sequelize/sequelize/issues/15426
    it('rolls back changes after inserting more than 1000 rows outside of a transaction', async function () {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      await User.sync({ force: true });

      try {
        await User.bulkCreate([...times(1000, () => ({ username: 'John' })), { username: null }]);
      } catch {
        // ignore
      }

      const count = await User.count();
      expect(count).to.equal(0);
    });
  });
}
