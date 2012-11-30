var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('HasMany', function() {
  var User      = null
    , Task      = null
    , sequelize = null
    , Helpers   = null

  var setup = function() {
    sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { logging: false })
    Helpers   = new (require("../config/helpers"))(sequelize)

    Helpers.dropAllTables()

    User = sequelize.define('User', { username: Sequelize.STRING })
    Task = sequelize.define('Task', { title: Sequelize.STRING })
  }

  beforeEach(function() { setup() })
  afterEach(function() { Helpers.dropAllTables() })

  describe('mono-directional', function() {
    it("adds the foreign key", function() {
      User.hasMany(Task)
      expect(Task.attributes.UserId).toEqual("INTEGER")
    })

    it('adds the foreign key with underscore', function() {
      User = sequelize.define('User', { username: Sequelize.STRING })
      Task = sequelize.define('Task', { title: Sequelize.STRING }, { underscored: true })

      Task.hasMany(User)

      expect(User.attributes.task_id).toBeDefined()
    })

    it('uses the passed foreign key', function() {
      User.hasMany(Task, { foreignKey: 'person_id' })
      expect(Task.attributes.person_id).toEqual("INTEGER")
    })

    it('defines getters and setters', function() {
      User.hasMany(Task)

      var u = User.build({username: 'asd'})
      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()
    })

    it("defines getters and setters according to the 'as' option", function() {
      User.hasMany(Task, {as: 'Tasks'})

      var u = User.build({username: 'asd'})

      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()
    })

    it("sets and gets associated objects", function() {
      var user, task1, task2;

      User.hasMany(Task, { as: 'Tasks' })

      Helpers.async(function(done) {
        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(done)
        })
      })

      Helpers.async(function(done) {
        User.create({username: 'name'}).success(function(_user) {
          Task.create({title: 'task1'}).success(function(_task1) {
            Task.create({title: 'task2'}).success(function(_task2) {
              user  = _user
              task1 = _task1
              task2 = _task2
              done()
            })
          })
        })
      })

      Helpers.async(function(done) {
        user.setTasks([task1, task2]).success(function() {
          user.getTasks().success(function(tasks) {
            expect(tasks.length).toEqual(2)
            user.getTasks({attributes: ['title']}).success(function(tasks) {
              expect(tasks[0].selectedValues.title).toEqual('task1')
              expect(tasks[0].selectedValues.id).toEqual(null)
              done()
            })
          })
        })
      })
    })

  it("should allow selfAssociation to be single linked (only one DAO is created)", function() {
    var oldLength = sequelize.daoFactoryManager.daos.length;

    var Comment = sequelize.define('Comment', { content: Sequelize.STRING })
    Comment.belongsTo(Comment, {as: "Parent"});
    Comment.hasMany(Comment, {as: 'Children', foreignKey: "ParentId", useJunctionTable: false})

    expect(sequelize.daoFactoryManager.daos.length).toEqual(oldLength + 1)

    Helpers.async(function(done) {
      Comment.sync({force: true}).success(function() {
        done()
      })
    })

    var parent
    Helpers.async(function(done) {
      Comment.create({ content: 'parentComment' }).success(function(p) {
        parent = p
        done()
      })
    })

    Helpers.async(function(done) {
      Comment.create({ content: 'child1' }).success(function(child1) {
        child1.setParent(parent).success(function() {
            done()
          })
      })
    })

    Helpers.async(function(done) {
      Comment.create({ content: 'child2' }).success(function(child2) {
        child2.setParent(parent).success(function() {
          done()
        })
      })
    })
    Helpers.async(function(done) {
      Comment.find({where: { content: 'parentComment' }}).success(function(parent) {
          parent.getChildren().success(function(children) {
            expect(children.length).toEqual(2)
          done()
          })
        })
      })
    })

    it("should still use many to many for selfAssociation by default (two DAOs are created)", function() {
      Helpers.async(function(done) {
        var oldLength = sequelize.daoFactoryManager.daos.length;

        var Comment = sequelize.define('Comment', { content: Sequelize.STRING })
        Comment.belongsTo(Comment, {as: "Parent"})
        Comment.hasMany(Comment, {as: 'Children'})

        expect(sequelize.daoFactoryManager.daos.length).toEqual(oldLength + 2)
        done();
      })
    })
  })

  describe('bi-directional', function() {
    it('adds the foreign key', function() {
      Task.hasMany(User)
      User.hasMany(Task)

      expect(Task.attributes.UserId).toBeUndefined()
      expect(User.attributes.UserId).toBeUndefined()

      var daos = sequelize.daoFactoryManager.daos.filter(function(dao) {
        return (dao.tableName == (Task.tableName + User.tableName))
      })

      daos.forEach(function(dao) {
        expect(dao.attributes.UserId).toBeDefined()
        expect(dao.attributes.TaskId).toBeDefined()
      })
    })

    it("adds the foreign key with underscores", function() {
      User = sequelize.define('User', { username: Sequelize.STRING }, { underscored: true })
      Task = sequelize.define('Task', { title: Sequelize.STRING })

      Task.hasMany(User)
      User.hasMany(Task)

      expect(Task.attributes.user_id).toBeUndefined()
      expect(User.attributes.user_id).toBeUndefined()

      var daos = sequelize.daoFactoryManager.daos.filter(function(dao) {
        return (dao.tableName == (Task.tableName + User.tableName))
      })

      daos.forEach(function(dao) {
        expect(dao.attributes.user_id).toBeDefined()
        expect(dao.attributes.TaskId).toBeDefined()
      })
    })

    it("uses the passed foreign keys", function() {
      User.hasMany(Task, { foreignKey: 'person_id' })
      Task.hasMany(User, { foreignKey: 'work_item_id' })

      var daos = sequelize.daoFactoryManager.daos.filter(function(dao) {
        return (dao.tableName == (Task.tableName + User.tableName))
      })

      daos.forEach(function(dao) {
        expect(dao.attributes.person_id).toBeDefined()
        expect(dao.attributes.work_item_id).toBeDefined()
      })
    })

    it("defines getters and setters", function() {
      User.hasMany(Task)
      Task.hasMany(User)

      var u = User.build({ username: 'asd' })
      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()

      var t = Task.build({ title: 'foobar' })
      expect(t.setUsers).toBeDefined()
      expect(t.getUsers).toBeDefined()
    })

    it("defines getters and setters according to the 'as' option", function() {
      User.hasMany(Task, { as: 'Tasks' })
      Task.hasMany(User, { as: 'Users' })

      var u = User.build({ username: 'asd' })
      expect(u.setTasks).toBeDefined()
      expect(u.getTasks).toBeDefined()

      var t = Task.build({ title: 'asd' })
      expect(t.setUsers).toBeDefined()
      expect(t.getUsers).toBeDefined()
    })

    it("sets and gets the corrected associated objects", function() {
      var users = []
        , tasks = []

      User.hasMany(Task, {as: 'Tasks'})
      Task.hasMany(User, {as: 'Users'})

      Helpers.async(function(done) {
        User.sync({force: true}).success(function() {
          Task.sync({force: true}).success(done)
        })
      })

      Helpers.async(function(done) {
        User.create({username: 'name'}).success(function(user1) {
          User.create({username: 'name2'}).success(function(user2) {
            Task.create({title: 'task1'}).success(function(task1) {
              Task.create({title: 'task2'}).success(function(task2) {
                users.push(user1)
                users.push(user2)
                tasks.push(task1)
                tasks.push(task2)
                done()
              })
            })
          })
        })
      })

      Helpers.async(function(done) {
        users[0].setTasks(tasks).success(function() {
          users[0].getTasks().success(function(_tasks) {
            expect(_tasks.length).toEqual(2)

            tasks[1].setUsers(users).success(function() {
              tasks[1].getUsers().success(function(_users) {
                expect(users.length).toEqual(2)
                done()
              })
            })
          })
        })
      })
    })
  })

  it("build the connector daos name", function() {
    Helpers.async(function(done) {
      var Person = sequelize.define('Person', { name: Sequelize.STRING })

      Person.hasMany(Person, {as: 'Children'})
      Person.hasMany(Person, {as: 'Friends'})
      Person.hasMany(Person, {as: 'CoWorkers'})

      Person.sync({force: true}).success(function() {
        var daoNames  = sequelize.daoFactoryManager.daos.map(function(dao) { return dao.tableName })
          , expectation = ["Persons", "ChildrenPersons", "CoWorkersPersons", "FriendsPersons"]

        expectation.forEach(function(ex) {
          expect(daoNames.indexOf(ex) > -1).toBeTruthy()
        })

        done()
      })
    })
  })

  it("allows join table to be specified", function() {
    Helpers.async(function(done) {
      var Child = sequelize.define('Child', { name: Sequelize.STRING }, {underscore: true, freezeTableName: true})
      var Parent = sequelize.define('Parent', { name: Sequelize.STRING }, {underscore: true, freezeTableName: true})
      var ParentJoin = sequelize.define('ParentRelationship', { parent_id: Sequelize.INTEGER, child_id: Sequelize.INTEGER }, {underscore: true, freezeTableName: true})

      Parent.hasMany(Child, {as: 'Children', foreignKey: 'child_id', joinTableName: 'ParentRelationship'})
      Child.hasMany(Parent, {as: 'Parents', foreignKey: 'parent_id', joinTableName: 'ParentRelationship'})

      var parents = []

      ParentJoin.sync({force: true}).success(function() {
        Parent.sync({force: true}).success(function() {
          Child.sync({force: true}).success(function() {
          Parent.create({name: 'mom'}).success(function(mom) {
            parents.push(mom)
            Parent.create({name: 'dad'}).success(function(dad) {
              parents.push(dad)
              Child.create({name: 'baby'}).success(function(baby) {
                baby.setParents(parents).success(function(){
                  parents[0].getChildren().success(function(children){
                    expect(children).not.toBe(null)
                    expect(children.length).toBeDefined()
                    expect(children.length).toEqual(1)
                    expect(children[0]).toBeDefined()
                    expect(children[0].name).toEqual('baby')
                    done()
                  })
                })
              })
            })
          })
        })
       })
      })
    })
  })

    it("allows join table to be mapped and specified", function() {
      var User = sequelize.define('User', { name: Sequelize.STRING }, {underscore: true, freezeTableName: true})
      var Company = sequelize.define('Company', { name: Sequelize.STRING }, {underscore: true, freezeTableName: true})
      var CompanyAccess = sequelize.define('CompanyAccess', { company_id: Sequelize.INTEGER, user_id: Sequelize.INTEGER, permission: Sequelize.STRING }, {underscore: true, freezeTableName: true})

      CompanyAccess.belongsTo(User, {as: 'User', foreignKey: 'user_id'})
      CompanyAccess.belongsTo(Company, {as: 'Company', foreignKey: 'company_id'})
      User.hasMany(Company, {as: 'Companies', foreignKey: 'user_id', joinTableName: 'CompanyAccess'})
      Company.hasMany(User, {as: 'Users', foreignKey: 'company_id', joinTableName: 'CompanyAccess'})

      Helpers.async(function(done) {

        var companies = []

      CompanyAccess.sync({force: true}).success(function() {
        User.sync({force: true}).success(function() {
          Company.sync({force: true}).success(function() {

            Company.create({name: 'IBM'}).success(function(ibm) {
              companies.push(ibm)
              Company.create({name: 'EA'}).success(function(ea) {
                companies.push(ea)
                User.create({name: 'joe@ibm.com'}).success(function(joe) {
                  joe.setCompanies(companies).success(function(){
                    User.find({where: {name: 'joe@ibm.com'}}).success(function(joe) {
                      expect(joe).not.toEqual(null)
                      joe.getCompanies().success(function(comps) {
                        expect(comps).not.toEqual(null)
                        expect(comps.length).toEqual(2)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })



  it("gets and sets the connector daos", function() {
    Helpers.async(function(done) {
      var Person = sequelize.define('Person', { name: Sequelize.STRING })

      Person.hasMany(Person, {as: 'Children'})
      Person.hasMany(Person, {as: 'Friends'})
      Person.hasMany(Person, {as: 'CoWorkers'})

      Person.sync({force: true}).success(function() {
        Person.create({name: 'foobar'}).success(function(person) {
          Person.create({name: 'friend'}).success(function(friend) {
            person.setFriends([friend]).success(function() {
              person.getFriends().success(function(friends) {
                expect(friends.length).toEqual(1)
                expect(friends[0].name).toEqual('friend')
                done()
              })
            })
          })
        })
      })
    })
  })
})
