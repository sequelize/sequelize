'use strict';

const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('sequelize/lib/data-types');
const moment = require('moment');

if (dialect === 'snowflake') {
  describe('[SNOWFLAKE Specific] Smoke test', () => {
    describe('[SNOWFLAKE Specific] Basic test for one table', () => {
      let User;

      before(async () => {
        const sequelize = Support.createSequelizeInstance();
        User = sequelize.define('User', {
          username: DataTypes.STRING,
          lastActivity: {
            type: DataTypes.DATE,
            get() {
              const value = this.getDataValue('lastActivity');
              return value ? value.valueOf() : 0;
            }
          }
        });

        await User.sync({ force: true });
        await User.create({ id: 1, username: 'jozef', lastActivity: new Date(Date.UTC(2021, 5, 21)) });
        await User.create({ id: 2, username: 'jeff', lastActivity: moment(Date.UTC(2021, 5, 22)).format('YYYY-MM-DD HH:mm:ss Z') });
      });

      after(async () =>{
        await User.drop();
      });

      it('findOne with where', async () => {
        const user = await User.findOne({
          where:
          {
            username: 'jeff'
          }
        });
        user.id.should.equal(2);
      });

      it('findOne with date attribute', async () => {
        const user = await User.findOne({
          where:
          {
            username: 'jeff'
          }
        });
        // user.lastActivity.should.be.equalTime(new Date(Date.UTC(2021, 5, 22)));
        user.lastActivity.should.equal(Date.UTC(2021, 5, 22));
      });

      it('findAll with orderby', async () => {
        const username = 'test';
        await User.create({ id: 3, username });
        const users = await User.findAll({
          order: [['createdAt', 'ASC']]
        });
        await users[users.length - 1].username.should.equal(username);
      });

      it('Update', async () => {
        const res = await User.update({ username: 'jozef1' }, {
          where: {
            id: 1
          }
        });
        // https://github.com/sequelize/sequelize/issues/7184
        await res[0].should.equal(1);
      });
    });


    describe('[SNOWFLAKE Specific] Test for auto_increment', () => {
      let Task;

      before(async () => {
        const sequelize = Support.createSequelizeInstance();
        Task = sequelize.define('Task', {
          id: {
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true
          },
          taskName: DataTypes.STRING
        });

        await Task.sync({ force: true });
        await Task.create({ taskName: 'task1' });
        await Task.create({ taskName: 'task2' });
      });

      after(async () =>{
        await Task.drop();
      });

      it('findOne with where', async () => {
        const user = await Task.findOne({
          where:
          {
            taskName: 'task2'
          }
        });
        user.id.should.equal(2);
      });

    });
  });
}
