/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Multiple Level Filters"), function() {
  it('can filter through belongsTo', function(done) {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Task = this.sequelize.define('Task', {title: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING })

    Project.belongsTo(User);
    User.hasMany(Project)

    Task.belongsTo(Project);
    Project.hasMany(Task);


    this.sequelize.sync({ force: true }).success(function() {
      User.bulkCreate([{
        id: 101,
        username: 'leia'
      }, {
        id: 102,
        username: 'vader'
      }]).success(function() {
        Project.bulkCreate([{
          id: 201,
          UserId: 101,
          title: 'republic'
        },{
          id: 202,
          UserId: 102,
          title: 'empire'
        }]).success(function() {
          Task.bulkCreate([{
            id: 301,
            ProjectId: 201,
            title: 'fight empire'
          },{
            id: 302,
            ProjectId: 201,
            title: 'stablish republic'
          },{
            id: 303,
            ProjectId: 202,
            title: 'destroy rebel alliance'
          },{
            id: 304,
            ProjectId: 202,
            title: 'rule everything'
          }]).success(function() {
            Task.findAll({
              where: {
                'project.user.username': 'leia'
              }
            }).success(function(tasks){
              try{
                expect(tasks.length).to.be.equal(2);
                expect(tasks[0].title).to.be.equal('fight empire');
                expect(tasks[1].title).to.be.equal('stablish republic');
                done();
              }catch(e){
                done(e);
              }
            })
          });
        });
      });
    })
  })

  it('avoids duplicated tables in query', function(done) {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Task = this.sequelize.define('Task', {title: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING })

    Project.belongsTo(User);
    User.hasMany(Project)

    Task.belongsTo(Project);
    Project.hasMany(Task);


    this.sequelize.sync({ force: true }).success(function() {
      User.bulkCreate([{
        id: 101,
        username: 'leia'
      }, {
        id: 102,
        username: 'vader'
      }]).success(function() {
        Project.bulkCreate([{
          id: 201,
          UserId: 101,
          title: 'republic'
        },{
          id: 202,
          UserId: 102,
          title: 'empire'
        }]).success(function() {
          Task.bulkCreate([{
            id: 301,
            ProjectId: 201,
            title: 'fight empire'
          },{
            id: 302,
            ProjectId: 201,
            title: 'stablish republic'
          },{
            id: 303,
            ProjectId: 202,
            title: 'destroy rebel alliance'
          },{
            id: 304,
            ProjectId: 202,
            title: 'rule everything'
          }]).success(function() {
            Task.findAll({
              where: {
                'project.user.username': 'leia',
                'project.user.id': 101
              }
            }).success(function(tasks){
              try{
                expect(tasks.length).to.be.equal(2);
                expect(tasks[0].title).to.be.equal('fight empire');
                expect(tasks[1].title).to.be.equal('stablish republic');
                done();
              }catch(e){
                done(e);
              }
            })
          });
        });
      });
    })
  })

  it('can filter through hasMany', function(done) {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Task = this.sequelize.define('Task', {title: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING })

    Project.belongsTo(User);
    User.hasMany(Project)

    Task.belongsTo(Project);
    Project.hasMany(Task);


    this.sequelize.sync({ force: true }).success(function() {
      User.bulkCreate([{
        id: 101,
        username: 'leia'
      }, {
        id: 102,
        username: 'vader'
      }]).success(function() {
        Project.bulkCreate([{
          id: 201,
          UserId: 101,
          title: 'republic'
        },{
          id: 202,
          UserId: 102,
          title: 'empire'
        }]).success(function() {
          Task.bulkCreate([{
            id: 301,
            ProjectId: 201,
            title: 'fight empire'
          },{
            id: 302,
            ProjectId: 201,
            title: 'stablish republic'
          },{
            id: 303,
            ProjectId: 202,
            title: 'destroy rebel alliance'
          },{
            id: 304,
            ProjectId: 202,
            title: 'rule everything'
          }]).success(function() {
            User.findAll({
              where: {
                'projects.tasks.title': 'fight empire'
              }
            }).success(function(users){
              try{
                expect(users.length).to.be.equal(1);
                expect(users[0].username).to.be.equal('leia');
                done();
              }catch(e){
                done(e);
              }
            })
          });
        });
      });
    })
  })

  it('can filter through hasMany connector', function(done) {
    var User = this.sequelize.define('User', {username: DataTypes.STRING })
      , Project = this.sequelize.define('Project', { title: DataTypes.STRING })

    Project.hasMany(User);
    User.hasMany(Project)

    this.sequelize.sync({ force: true }).success(function() {
      User.bulkCreate([{
        id: 101,
        username: 'leia'
      }, {
        id: 102,
        username: 'vader'
      }]).success(function() {
        Project.bulkCreate([{
          id: 201,
          title: 'republic'
        },{
          id: 202,
          title: 'empire'
        }]).success(function() {
          User.find(101).success(function(user){
            Project.find(201).success(function(project){
              user.setProjects([project]).success(function(){

                User.find(102).success(function(user){
                  Project.find(202).success(function(project){
                    user.setProjects([project]).success(function(){
                      User.findAll({
                        where: {
                          'projects.title': 'republic'
                        }
                      }).success(function(users){
                        try{
                          expect(users.length).to.be.equal(1);
                          expect(users[0].username).to.be.equal('leia');
                          done();
                        }catch(e){
                          done(e);
                        }
                      })
                    });
                  });
                });

              });
            });
          });
        });
      });
    })
  })
})
