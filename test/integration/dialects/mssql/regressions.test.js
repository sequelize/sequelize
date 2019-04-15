'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Regressions', () => {
    it('does not duplicate columns in ORDER BY statement, #9008', function () {
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
        .spread((vyom, shakti, nikita, arya) => {
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
}
