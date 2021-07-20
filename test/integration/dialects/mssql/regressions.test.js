'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon =  require('sinon'),
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe(Support.getTestDialectTeaser('Regressions'), () => {
    it('does not duplicate columns in ORDER BY statement, #9008', async function() {
      const LoginLog = this.sequelize.define('LoginLog', {
        ID: {
          field: 'id',
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        UserID: {
          field: 'userid',
          type: Sequelize.UUID,
          allowNull: false
        }
      });

      const User = this.sequelize.define('User', {
        UserID: {
          field: 'userid',
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        UserName: {
          field: 'username',
          type: Sequelize.STRING(50),
          allowNull: false
        }
      });

      LoginLog.belongsTo(User, {
        foreignKey: 'UserID'
      });
      User.hasMany(LoginLog, {
        foreignKey: 'UserID'
      });

      await this.sequelize.sync({ force: true });

      const [vyom, shakti, nikita, arya] = await User.bulkCreate([
        { UserName: 'Vayom' },
        { UserName: 'Shaktimaan' },
        { UserName: 'Nikita' },
        { UserName: 'Aryamaan' }
      ], { returning: true });

      await Promise.all([
        vyom.createLoginLog(),
        shakti.createLoginLog(),
        nikita.createLoginLog(),
        arya.createLoginLog()
      ]);

      const logs = await LoginLog.findAll({
        include: [
          {
            model: User,
            where: {
              UserName: {
                [Op.like]: '%maan%'
              }
            }
          }
        ],
        order: [[User, 'UserName', 'DESC']],
        offset: 0,
        limit: 10
      });

      expect(logs).to.have.length(2);
      expect(logs[0].User.get('UserName')).to.equal('Shaktimaan');
      expect(logs[1].User.get('UserName')).to.equal('Aryamaan');

      // #11258 and similar
      const otherLogs = await LoginLog.findAll({
        include: [
          {
            model: User,
            where: {
              UserName: {
                [Op.like]: '%maan%'
              }
            }
          }
        ],
        order: [['id', 'DESC']],
        offset: 0,
        limit: 10
      });

      expect(otherLogs).to.have.length(2);
      expect(otherLogs[0].User.get('UserName')).to.equal('Aryamaan');
      expect(otherLogs[1].User.get('UserName')).to.equal('Shaktimaan');

      // Separate queries can apply order freely
      const separateUsers = await User.findAll({
        include: [
          {
            model: LoginLog,
            separate: true,
            order: [
              'id'
            ]
          }
        ],
        where: {
          UserName: {
            [Op.like]: '%maan%'
          }
        },
        order: ['UserName', ['UserID', 'DESC']],
        offset: 0,
        limit: 10
      });

      expect(separateUsers).to.have.length(2);
      expect(separateUsers[0].get('UserName')).to.equal('Aryamaan');
      expect(separateUsers[0].get('LoginLogs')).to.have.length(1);
      expect(separateUsers[1].get('UserName')).to.equal('Shaktimaan');
      expect(separateUsers[1].get('LoginLogs')).to.have.length(1);
    });

    it('allow referencing FK to different tables in a schema with onDelete, #10125', async function() {
      const Child = this.sequelize.define(
        'Child',
        {},
        {
          timestamps: false,
          freezeTableName: true,
          schema: 'a'
        }
      );
      const Toys = this.sequelize.define(
        'Toys',
        {},
        {
          timestamps: false,
          freezeTableName: true,
          schema: 'a'
        }
      );
      const Parent = this.sequelize.define(
        'Parent',
        {},
        {
          timestamps: false,
          freezeTableName: true,
          schema: 'a'
        }
      );

      Child.hasOne(Toys, {
        onDelete: 'CASCADE'
      });

      Parent.hasOne(Toys, {
        onDelete: 'CASCADE'
      });

      const spy = sinon.spy();

      await this.sequelize.queryInterface.createSchema('a');
      await this.sequelize.sync({
        force: true,
        logging: spy
      });

      expect(spy).to.have.been.called;
      const log = spy.args.find(arg => arg[0].includes('IF OBJECT_ID(\'[a].[Toys]\', \'U\') IS NULL CREATE TABLE'))[0];

      expect(log.match(/ON DELETE CASCADE/g).length).to.equal(2);
    });

    it('sets the varchar(max) length correctly on describeTable', async function() {
      const Users = this.sequelize.define('_Users', {
        username: Sequelize.STRING('MAX')
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      const metadata = await this.sequelize.getQueryInterface().describeTable('_Users');
      const username = metadata.username;
      expect(username.type).to.include('(MAX)');
    });

    it('sets the char(10) length correctly on describeTable', async function() {
      const Users = this.sequelize.define('_Users', {
        username: Sequelize.CHAR(10)
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      const metadata = await this.sequelize.getQueryInterface().describeTable('_Users');
      const username = metadata.username;
      expect(username.type).to.include('(10)');
    });

    it('saves value bigger than 2147483647, #11245', async function() {
      const BigIntTable =  this.sequelize.define('BigIntTable', {
        business_id: {
          type: Sequelize.BIGINT,
          allowNull: false
        }
      }, {
        freezeTableName: true
      });

      const bigIntValue = 2147483648;

      await BigIntTable.sync({ force: true });

      await BigIntTable.create({
        business_id: bigIntValue
      });

      const record = await BigIntTable.findOne();
      expect(Number(record.business_id)).to.equals(bigIntValue);
    });

    it('saves boolean is true, #12090', async function() {
      const BooleanTable =  this.sequelize.define('BooleanTable', {
        status: {
          type: Sequelize.BOOLEAN,
          allowNull: false
        }
      }, {
        freezeTableName: true
      });

      const value = true;

      await BooleanTable.sync({ force: true });

      await BooleanTable.create({
        status: value
      });

      const record = await BooleanTable.findOne();
      expect(record.status).to.equals(value);
    });
  });
}
