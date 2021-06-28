'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('../../../../lib/data-types');
const moment = require('moment');

if (dialect === 'snowflake') {
  describe('[SNOWFLAKE Specific] Connection Manager', () => {
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


    // fake test for now since keepDefaultTimezone is commented out in snowflake dialect
    it('should acquire a valid connection when keepDefaultTimezone is true', async () => {
      const sequelize = Support.createSequelizeInstance({ keepDefaultTimezone: true, pool: { min: 1, max: 1, handleDisconnects: true, idle: 5000 } });
      const cm = sequelize.connectionManager;

      await sequelize.sync();

      const connection = await cm.getConnection();
      expect(cm.validate(connection)).to.be.ok;
      await cm.releaseConnection(connection);
    });
  });
}
