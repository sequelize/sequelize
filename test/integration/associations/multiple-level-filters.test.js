'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Multiple Level Filters'), function() {
  it('can filter through belongsTo', function() {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Task = this.sequelize.define('Task', {title: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(function() {
      return User.bulkCreate([{
        username: 'leia'
      }, {
        username: 'vader'
      }]).then(function() {
        return Project.bulkCreate([{
          UserId: 1,
          title: 'republic'
        },{
          UserId: 2,
          title: 'empire'
        }]).then(function() {
          return Task.bulkCreate([{
            ProjectId: 1,
            title: 'fight empire'
          },{
            ProjectId: 1,
            title: 'stablish republic'
          },{
            ProjectId: 2,
            title: 'destroy rebel alliance'
          },{
            ProjectId: 2,
            title: 'rule everything'
          }]).then(function() {
            return Task.findAll({
              include: [
                {model: Project, include: [
                  {model: User, where: {username: 'leia'}}
                ]}
              ]
            }).then(function(tasks) {
              expect(tasks.length).to.be.equal(2);
              expect(tasks[0].title).to.be.equal('fight empire');
              expect(tasks[1].title).to.be.equal('stablish republic');
            });
          });
        });
      });
    });
  });

  it('avoids duplicated tables in query', function() {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Task = this.sequelize.define('Task', {title: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(function() {
      return User.bulkCreate([{
        username: 'leia'
      }, {
        username: 'vader'
      }]).then(function() {
        return Project.bulkCreate([{
          UserId: 1,
          title: 'republic'
        },{
          UserId: 2,
          title: 'empire'
        }]).then(function() {
          return Task.bulkCreate([{
            ProjectId: 1,
            title: 'fight empire'
          },{
            ProjectId: 1,
            title: 'stablish republic'
          },{
            ProjectId: 2,
            title: 'destroy rebel alliance'
          },{
            ProjectId: 2,
            title: 'rule everything'
          }]).then(function() {
            return Task.findAll({
              include: [
                {model: Project, include: [
                  {model: User, where: {
                    username: 'leia',
                    id: 1
                  }}
                ]}
              ]
            }).then(function(tasks) {
              expect(tasks.length).to.be.equal(2);
              expect(tasks[0].title).to.be.equal('fight empire');
              expect(tasks[1].title).to.be.equal('stablish republic');
            });
          });
        });
      });
    });
  });

  it('can filter through hasMany', function() {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Task = this.sequelize.define('Task', {title: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(function() {
      return User.bulkCreate([{
        username: 'leia'
      }, {
        username: 'vader'
      }]).then(function() {
        return Project.bulkCreate([{
          UserId: 1,
          title: 'republic'
        },{
          UserId: 2,
          title: 'empire'
        }]).then(function() {
          return Task.bulkCreate([{
            ProjectId: 1,
            title: 'fight empire'
          },{
            ProjectId: 1,
            title: 'stablish republic'
          },{
            ProjectId: 2,
            title: 'destroy rebel alliance'
          },{
            ProjectId: 2,
            title: 'rule everything'
          }]).then(function() {
            return User.findAll({
              include: [
                {model: Project, include: [
                  {model: Task, where: {title: 'fight empire'}}
                ]}
              ]
            }).then(function(users) {
              expect(users.length).to.be.equal(1);
              expect(users[0].username).to.be.equal('leia');
            });
          });
        });
      });
    });
  });

  it('can filter through hasMany connector', function() {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsToMany(User, {through: 'user_project'});
    User.belongsToMany(Project, {through: 'user_project'});

    return this.sequelize.sync({ force: true }).then(function() {
      return User.bulkCreate([{
        username: 'leia'
      }, {
        username: 'vader'
      }]).then(function() {
        return Project.bulkCreate([{
          title: 'republic'
        },{
          title: 'empire'
        }]).then(function() {
          return User.findById(1).then(function(user) {
            return Project.findById(1).then(function(project) {
              return user.setProjects([project]).then(function() {
                return User.findById(2).then(function(user) {
                  return Project.findById(2).then(function(project) {
                    return user.setProjects([project]).then(function() {
                      return User.findAll({
                        include: [
                          {model: Project, where: {title: 'republic'}}
                        ]
                      }).then(function(users) {
                        expect(users.length).to.be.equal(1);
                        expect(users[0].username).to.be.equal('leia');
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
