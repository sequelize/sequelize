'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      age: DataTypes.INTEGER
    });
    this.Project = this.sequelize.define('Project', {
      name: DataTypes.STRING
    });

    this.User.hasMany(this.Project);
    this.Project.belongsTo(this.User);

    return this.sequelize.sync({force: true});
  });


  describe('findOrBuild', () => {
    it('initialize with includes', function() {
      return this.User.bulkCreate([
        { username: 'Mello', age: 10 },
        { username: 'Mello', age: 20 }
      ], { returning: true }).spread((user1, user2) => {
        return this.Project.create({
          name: 'Investigate'
        }).then(project => user2.setProjects([project]));
      }).then(() => {
        return this.User.findOrBuild({
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
      }).spread((user, created) => {
        expect(created).to.be.false;
        expect(user.get('id')).to.be.ok;
        expect(user.get('username')).to.equal('Mello');
        expect(user.get('age')).to.equal(20);

        expect(user.Projects).to.have.length(1);
        expect(user.Projects[0].get('name')).to.equal('Investigate');
      });
    });
  });
});
