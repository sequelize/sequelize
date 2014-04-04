/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , Sequelize = require('../../index')

chai.config.includeStack = true

describe(Support.getTestDialectTeaser("BelongsTo"), function() {
  describe("Model.associations", function () {
    it("should store all assocations when associting to the same table multiple times", function () {
      var User  = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      Group.belongsTo(User)
      Group.belongsTo(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' })
      Group.belongsTo(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' })

      expect(Object.keys(Group.associations)).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers'])
    })
  })

  describe('getAssociation', function() {
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User  = sequelize.define('User', { username: Support.Sequelize.STRING })
          , Group = sequelize.define('Group', { name: Support.Sequelize.STRING })

        Group.belongsTo(User)

        sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Group.create({ name: 'bar' }).success(function(group) {
              sequelize.transaction(function(t) {
                group.setUser(user, { transaction: t }).success(function() {
                  Group.all().success(function(groups) {
                    groups[0].getUser().success(function(associatedUser) {
                      expect(associatedUser).to.be.null
                      Group.all({ transaction: t }).success(function(groups) {
                        groups[0].getUser({ transaction: t }).success(function(associatedUser) {
                          expect(associatedUser).to.be.not.null
                          t.rollback().success(function() { done() })
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

    it('should be able to handle a where object that\'s a first class citizen.', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING })

      Task.belongsTo(User)
      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo', gender: 'male' }).success(function(user) {
            User.create({ username: 'bar', gender: 'female' }).success(function(falsePositiveCheck) {
              Task.create({ title: 'task', status: 'inactive' }).success(function(task) {
                task.setUserXYZ(user).success(function() {
                  task.getUserXYZ({where: ['gender = ?', 'female']}).success(function(user) {
                    expect(user).to.be.null
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it('supports schemas', function (done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }).schema('archive')
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING }).schema('archive')
        , self = this

      Task.belongsTo(User)

      self.sequelize.dropAllSchemas().done(function() {
        self.sequelize.createSchema('archive').done(function () {
          self.sequelize.sync({force: true }).done(function () {
            User.create({ username: 'foo', gender: 'male' }).success(function(user) {
              Task.create({ title: 'task', status: 'inactive' }).success(function(task) {
                task.setUserXYZ(user).success(function() {
                  task.getUserXYZ().success(function(user) {
                    expect(user).to.be.ok
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

  describe('setAssociation', function() {
    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User  = sequelize.define('User', { username: Support.Sequelize.STRING })
          , Group = sequelize.define('Group', { name: Support.Sequelize.STRING })

        Group.belongsTo(User)

        sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Group.create({ name: 'bar' }).success(function(group) {
              sequelize.transaction(function(t) {
                group.setUser(user, { transaction: t }).success(function() {
                  Group.all().success(function(groups) {
                    groups[0].getUser().success(function(associatedUser) {
                      expect(associatedUser).to.be.null
                      t.rollback().success(function() { done() })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    it('can set the association with declared primary keys...', function(done) {
      var User = this.sequelize.define('UserXYZ', { user_id: {type: DataTypes.INTEGER, primaryKey: true }, username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { task_id: {type: DataTypes.INTEGER, primaryKey: true }, title: DataTypes.STRING })

      Task.belongsTo(User, { foreignKey: 'user_id' })

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ user_id: 1, username: 'foo' }).success(function(user) {
          Task.create({ task_id: 1, title: 'task' }).success(function(task) {
            task.setUserXYZ(user).success(function() {
              task.getUserXYZ().success(function(user) {
                expect(user).not.to.be.null

                task.setUserXYZ(null).success(function() {
                  task.getUserXYZ().success(function(user) {
                    expect(user).to.be.null
                    done()
                  })
                })

              })
            })
          })
        })
      })
    })

    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING })

      Task.belongsTo(User)

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUserXYZ(user).success(function() {
              task.getUserXYZ().success(function(user) {
                expect(user).not.to.be.null

                task.setUserXYZ(null).success(function() {
                  task.getUserXYZ().success(function(user) {
                    expect(user).to.be.null
                    done()
                  })
                })

              })
            })
          })
        })
      })
    })

    it('should not clobber atributes', function (done) {
      var Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      var Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasOne(Comment);
      Comment.belongsTo(Post);

      this.sequelize.sync().done(function (err) {
        Post.create({
          title: 'Post title',
        }).done(function(err, post) {
          Comment.create({
            text: 'OLD VALUE',
          }).done(function(err, comment) {
            comment.setPost(post).done(function(err) {
              expect(comment.text).to.equal('UPDATED VALUE');
              done()
            });

            comment.text = 'UPDATED VALUE';
          });
        });
      })
    })
  })

  describe('createAssociation', function() {
    it('creates an associated model instance', function(done) {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING })

      Task.belongsTo(User)

      this.sequelize.sync({ force: true }).success(function() {
        Task.create({ title: 'task' }).success(function(task) {
          task.createUser({ username: 'bob' }).success(function() {
            task.getUser().success(function(user) {
              expect(user).not.to.be.null
              expect(user.username).to.equal('bob')

              done()
            })
          })
        })
      })
    })

    it('supports transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User  = sequelize.define('User', { username: Support.Sequelize.STRING })
          , Group = sequelize.define('Group', { name: Support.Sequelize.STRING })

        Group.belongsTo(User)

        sequelize.sync({ force: true }).success(function() {
          Group.create({ name: 'bar' }).success(function(group) {
            sequelize.transaction(function(t) {
              group.createUser({ username: 'foo' }, { transaction: t }).success(function() {
                group.getUser().success(function(user) {
                  expect(user).to.be.null

                  group.getUser({ transaction: t }).success(function(user) {
                    expect(user).not.to.be.null

                    t.rollback().success(function() { done() })
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  describe("foreign key", function () {
    it('should lowercase foreign keys when using underscored', function () {
      var User  = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true })

      User.belongsTo(Account)

      expect(User.rawAttributes.account_id).to.exist;
    });
    it('should use model name when using camelcase', function () {
      var User  = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false })

      User.belongsTo(Account)

      expect(User.rawAttributes.AccountId).to.exist;
    });
  });

  describe("foreign key constraints", function() {
    it("are enabled by default", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      Task.belongsTo(User) // defaults to SET NULL

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
              user.destroy().success(function() {
                task.reload().success(function() {
                  expect(task.UserId).to.equal(null)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("should be possible to disable them", function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING })

      Task.belongsTo(User, { constraints: false })

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
              user.destroy().success(function() {
                task.reload().success(function() {
                  expect(task.UserId).to.equal(user.id)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can cascade deletes", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      Task.belongsTo(User, {onDelete: 'cascade'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
              user.destroy().success(function() {
                Task.findAll().success(function(tasks) {
                  expect(tasks).to.have.length(0)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can restrict deletes", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      Task.belongsTo(User, {onDelete: 'restrict'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
              user.destroy().error(function() {
                // Should fail due to FK restriction
                Task.findAll().success(function(tasks) {
                  expect(tasks).to.have.length(1)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can cascade updates", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      Task.belongsTo(User, {onUpdate: 'cascade'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {

              // Changing the id of a DAO requires a little dance since
              // the `UPDATE` query generated by `save()` uses `id` in the
              // `WHERE` clause

              var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model)
              user.QueryInterface.update(user, tableName, {id: 999}, user.id)
              .success(function() {
                Task.findAll().success(function(tasks) {
                  expect(tasks).to.have.length(1)
                  expect(tasks[0].UserId).to.equal(999)
                  done()
                })
              })
            })
          })
        })
      })
    })

    it("can restrict updates", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      Task.belongsTo(User, {onUpdate: 'restrict'})

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {

              // Changing the id of a DAO requires a little dance since
              // the `UPDATE` query generated by `save()` uses `id` in the
              // `WHERE` clause

              var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model)
              user.QueryInterface.update(user, tableName, {id: 999}, user.id)
              .error(function() {
                // Should fail due to FK restriction
                Task.findAll().success(function(tasks) {
                  expect(tasks).to.have.length(1)
                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  describe("Association column", function() {
    it('has correct type and name for non-id primary keys with non-integer type', function(done) {
      var User = this.sequelize.define('UserPKBT', {
        username: {
          type: DataTypes.STRING
        }
      })
        , self = this

      var Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      })

      User.belongsTo(Group)

      self.sequelize.sync({ force: true }).success(function() {
        expect(User.rawAttributes.GroupPKBTName.type.toString()).to.equal(DataTypes.STRING.toString())
        done()
      })
    })
  })

  describe("Association options", function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , dataTypes = [DataTypes.INTEGER, DataTypes.BIGINT, DataTypes.STRING]
        , self = this
        , Tasks = {}

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString()
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING })

        Tasks[dataType].belongsTo(User, { foreignKey: 'userId', keyType: dataType, constraints: false })
      })

      self.sequelize.sync({ force: true })
      .success(function() {
        dataTypes.forEach(function(dataType, i) {
          expect(Tasks[dataType].rawAttributes.userId.type.toString())
            .to.equal(dataType.toString())

          if ((i+1) === dataTypes.length) {
            done()
          }
        })
      })
    })
  })
})
