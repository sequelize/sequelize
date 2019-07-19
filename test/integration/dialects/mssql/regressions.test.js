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
  
  it('not returning in update when table include a trigger', function() {
    const TriggerTable = this.sequelize.define('TriggerTable', {
      ID: {
        type: Sequelize.NUMERIC,
        primaryKey: true
      },
      Column1: {
        type: Sequelize.STRING(50),
        allowNull: false
      }
    }, {
      tableName: 'TriggerTable'
    });

    return TriggerTable.sync({ force: true }).then(() => {
      const TriggerForTable = `
      CREATE TRIGGER [SIMPLE_TRIGGER_UPDATE] ON [TriggerTable] AFTER UPDATE
      AS 
      BEGIN
        -- SET NOCOUNT ON added to prevent extra result sets from
        SET NOCOUNT ON;
      END`;

      return this.sequelize.query(TriggerForTable).then(() => {
        return TriggerTable.create({
          ID: 1,
          Column1: 'foo text'
        });
      }).then(() => {
        return TriggerTable.update({ Column1: 'FOO TEXT UPDATE' }, {
          where: {
            ID: 1
          },
          returning: false
        }).then(() => {
          return true;
        }).catch(error => {
          return error.message;
        });
      }).then(BoolUpdate => {
        expect(BoolUpdate).to.equals(true);
      });
    });
  });
}
