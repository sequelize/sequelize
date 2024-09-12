'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      age: DataTypes.INTEGER
    });
    this.Project = this.sequelize.define('Project', {
      name: DataTypes.STRING
    });

    this.User.hasMany(this.Project);
    this.Project.belongsTo(this.User);

    await this.sequelize.sync({ force: true });
  });


  describe('findOrBuild', () => {
    it('initialize with includes', async function() {
      const [, user2] = await this.User.bulkCreate([
        { username: 'Mello', age: 10 },
        { username: 'Mello', age: 20 }
      ], { returning: true });

      const project = await this.Project.create({
        name: 'Investigate'
      });

      await user2.setProjects([project]);

      const [user, created] = await this.User.findOrBuild({
        defaults: {
          username: 'Mello',
          age: 10
        },
        where: {
          age: 20
        },
        include: [{
          model: this.Project
        }]
      });

      expect(created).to.be.false;
      expect(user.get('id')).to.be.ok;
      expect(user.get('username')).to.equal('Mello');
      expect(user.get('age')).to.equal(20);

      expect(user.Projects).to.have.length(1);
      expect(user.Projects[0].get('name')).to.equal('Investigate');
    });
  });
});
