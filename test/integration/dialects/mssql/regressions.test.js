'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Regressions', () => {
    it('does not duplicate columns in ORDER BY statement, #9008', function() {
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

      return this.sequelize.sync({ force: true })
        .then(() => User.bulkCreate([
          { UserName: 'Vayom' },
          { UserName: 'Shaktimaan' },
          { UserName: 'Nikita' },
          { UserName: 'Aryamaan' }
        ], { returning: true }))
        .then(([vyom, shakti, nikita, arya]) => {
          return Sequelize.Promise.all([
            vyom.createLoginLog(),
            shakti.createLoginLog(),
            nikita.createLoginLog(),
            arya.createLoginLog()
          ]);
        }).then(() => {
          return LoginLog.findAll({
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
        }).then(logs => {
          expect(logs).to.have.length(2);
          expect(logs[0].User.get('UserName')).to.equal('Shaktimaan');
          expect(logs[1].User.get('UserName')).to.equal('Aryamaan');
        });
    });
  });

  it('sets the varchar(max) length correctly on describeTable', function() {
    const Users = this.sequelize.define('_Users', {
      username: Sequelize.STRING('MAX')
    }, { freezeTableName: true });

    return Users.sync({ force: true }).then(() => {
      return this.sequelize.getQueryInterface().describeTable('_Users').then(metadata => {
        const username = metadata.username;
        expect(username.type).to.include('(MAX)');
      });
    });
  });

  it('sets the char(10) length correctly on describeTable', function() {
    const Users = this.sequelize.define('_Users', {
      username: Sequelize.CHAR(10)
    }, { freezeTableName: true });

    return Users.sync({ force: true }).then(() => {
      return this.sequelize.getQueryInterface().describeTable('_Users').then(metadata => {
        const username = metadata.username;
        expect(username.type).to.include('(10)');
      });
    });
  });

  it('saves value bigger than 2147483647, #11245', function() {
    const BigIntTable =  this.sequelize.define('BigIntTable', {
      business_id: {
        type: Sequelize.BIGINT,
        allowNull: false
      }
    }, {
      freezeTableName: true
    });

    const bigIntValue = 2147483648;

    return BigIntTable.sync({ force: true })
      .then(() => {
        return BigIntTable.create({
          business_id: bigIntValue
        });
      })
      .then(() => BigIntTable.findOne())
      .then(record => {
        expect(Number(record.business_id)).to.equals(bigIntValue);
      });
  });
}
