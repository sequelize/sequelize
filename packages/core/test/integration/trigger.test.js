'use strict';

const chai = require('chai');
const { DataTypes } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../support');

const dialect = Support.getTestDialect();
const current = Support.sequelize;

if (current.dialect.supports.tmpTableTrigger) {
  describe(Support.getTestDialectTeaser('Model'), () => {
    describe('trigger', () => {
      let User;
      let triggerQuery =
        'create trigger User_ChangeTracking on [users] for insert,update, delete \n' +
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
        triggerQuery =
          'CREATE OR REPLACE TRIGGER User_ChangeTracking\n' +
          'AFTER INSERT ON "users"\n' +
          'FOR EACH STATEMENT\n' +
          'BEGIN ATOMIC\n' +
          '  SELECT * FROM "users";\n' +
          'END';
      }

      beforeEach(async function () {
        User = this.sequelize.define(
          'user',
          {
            username: {
              type: DataTypes.STRING,
              field: 'user_name',
            },
          },
          {
            hasTrigger: true,
          },
        );

        await User.sync({ force: true });

        await this.sequelize.query(triggerQuery, { type: this.sequelize.QueryTypes.RAW });
      });

      it('should return output rows after insert', async () => {
        await User.create({
          username: 'triggertest',
        });

        await expect(User.findOne({ username: 'triggertest' }))
          .to.eventually.have.property('username')
          .which.equals('triggertest');
      });

      if (dialect === 'mssql') {
        it('when a trigger emits rows, maps bulk insert output by source row', async () => {
          // Arrange
          await current.query('DROP TRIGGER User_ChangeTracking');
          await current.query(
            'CREATE TRIGGER User_ChangeTracking ON [users] AFTER INSERT AS BEGIN SET NOCOUNT ON; SELECT COUNT(*) AS trigger_count FROM inserted; END',
          );

          // Act
          const users = await User.bulkCreate([{ username: 'second' }, { username: 'first' }], {
            returning: ['id', 'username'],
          });

          // Assert
          const persistedUsers = await User.findAll();
          const idsByUsername = new Map(persistedUsers.map(user => [user.username, user.id]));
          expect(users.map(user => user.id)).to.deep.equal([
            idsByUsername.get('second'),
            idsByUsername.get('first'),
          ]);
        });
      }

      it('should return output rows after instance update', async () => {
        const user = await User.create({
          username: 'triggertest',
        });

        user.username = 'usernamechanged';
        await user.save();
        await expect(User.findOne({ username: 'usernamechanged' }))
          .to.eventually.have.property('username')
          .which.equals('usernamechanged');
      });

      it('should return output rows after Model update', async () => {
        const user = await User.create({
          username: 'triggertest',
        });

        await User.update(
          {
            username: 'usernamechanged',
          },
          {
            where: {
              id: user.get('id'),
            },
          },
        );

        await expect(User.findOne({ username: 'usernamechanged' }))
          .to.eventually.have.property('username')
          .which.equals('usernamechanged');
      });

      it('should successfully delete with a trigger on the table', async () => {
        const user = await User.create({
          username: 'triggertest',
        });

        await user.destroy();
        await expect(User.findOne({ username: 'triggertest' })).to.eventually.be.null;
      });
    });
  });
}
