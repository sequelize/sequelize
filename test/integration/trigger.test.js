'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  dialect = Support.getTestDialect(),
  current = Support.sequelize;

if (current.dialect.supports.tmpTableTrigger) {
  describe(Support.getTestDialectTeaser('Model'), () => {
    describe('trigger', () => {
      let User;
      let triggerQuery = 'create trigger User_ChangeTracking on [users] for insert,update, delete \n' +
                          'as\n' +
                            'SET NOCOUNT ON\n' +
                            'if exists(select 1 from inserted)\n' +
                            'begin\n' +
                              'select * from inserted\n' +
                            'end\n' +
                            'if exists(select 1 from deleted)\n' +
                            'begin\n' +
                              'select * from deleted\n' +
                            'end\n';
      if (dialect === 'db2') {
        triggerQuery = 'CREATE OR REPLACE TRIGGER User_ChangeTracking\n' +
                       'AFTER INSERT ON "users"\n' +
                       'FOR EACH STATEMENT\n' +
                       'BEGIN ATOMIC\n' +
                       '  SELECT * FROM "users";\n' +
                       'END';
      }

      beforeEach(async function() {
        User = this.sequelize.define('user', {
          username: {
            type: Sequelize.STRING,
            field: 'user_name'
          }
        }, {
          hasTrigger: true
        });

        await User.sync({ force: true });

        await this.sequelize.query(triggerQuery, { type: this.sequelize.QueryTypes.RAW });
      });

      it('should return output rows after insert', async () => {
        await User.create({
          username: 'triggertest'
        });

        await expect(User.findOne({ username: 'triggertest' })).to.eventually.have.property('username').which.equals('triggertest');
      });

      it('should return output rows after instance update', async () => {
        const user = await User.create({
          username: 'triggertest'
        });

        user.username = 'usernamechanged';
        await user.save();
        await expect(User.findOne({ username: 'usernamechanged' })).to.eventually.have.property('username').which.equals('usernamechanged');
      });

      it('should return output rows after Model update', async () => {
        const user = await User.create({
          username: 'triggertest'
        });

        await User.update({
          username: 'usernamechanged'
        }, {
          where: {
            id: user.get('id')
          }
        });

        await expect(User.findOne({ username: 'usernamechanged' })).to.eventually.have.property('username').which.equals('usernamechanged');
      });

      it('should successfully delete with a trigger on the table', async () => {
        const user = await User.create({
          username: 'triggertest'
        });

        await user.destroy();
        await expect(User.findOne({ username: 'triggertest' })).to.eventually.be.null;
      });
    });
  });
}
