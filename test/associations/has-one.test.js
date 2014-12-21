'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , Sequelize = require('../../index')
  , Promise = Sequelize.Promise
  , current = Support.sequelize;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('HasOne'), function() {
  describe('Model.associations', function() {
    it('should store all assocations when associting to the same table multiple times', function() {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Group.hasOne(User);
      Group.hasOne(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.hasOne(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(Object.keys(Group.associations)).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('getAssocation', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.hasOne(User);

          sequelize.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(fakeUser) {
              User.create({ username: 'foo' }).success(function(user) {
                Group.create({ name: 'bar' }).success(function(group) {
                  sequelize.transaction().then(function(t) {
                    group.setUser(user, { transaction: t }).success(function() {
                      Group.all().success(function(groups) {
                        groups[0].getUser().success(function(associatedUser) {
                          expect(associatedUser).to.be.null;
                          Group.all({ transaction: t }).success(function(groups) {
                            groups[0].getUser({ transaction: t }).success(function(associatedUser) {
                              expect(associatedUser).not.to.be.null;
                              expect(associatedUser.id).to.equal(user.id);
                              expect(associatedUser.id).not.to.equal(fakeUser.id);
                              t.rollback().success(function() { done(); });
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
    }

    it('does not modify the passed arguments', function() {
      var User = this.sequelize.define('user', {})
        , Project = this.sequelize.define('project', {});

      User.hasOne(Project);

      return this.sequelize.sync({ force: true }).bind(this).then(function() {
        return User.create({});
      }).then(function(user) {
        this.options = {};

        return user.getProject(this.options);
      }).then(function() {
        expect(this.options).to.deep.equal({});
      });
    });

    it('should be able to handle a where object that\'s a first class citizen.', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      User.hasOne(Task);
      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task', status: 'inactive' }).success(function(task) {
              user.setTaskXYZ(task).success(function() {
                user.getTaskXYZ({where: ['status = ?', 'active']}).success(function(task) {
                  expect(task).to.be.null;
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('setAssociation', function() {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.hasOne(User);

          sequelize.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Group.create({ name: 'bar' }).success(function(group) {
                sequelize.transaction().then(function(t) {
                  group
                    .setUser(user, { transaction: t })
                    .success(function() {
                      Group.all().success(function(groups) {
                        groups[0].getUser().success(function(associatedUser) {
                          expect(associatedUser).to.be.null;
                          t.rollback().success(function() { done(); });
                        });
                      });
                    })
                    .on('sql', function(sql, uuid) {
                      expect(uuid).to.not.equal('default');
                    });
                });
              });
            });
          });
        });
      });
    }

    it('can set an association with predefined primary keys', function(done) {
      var User = this.sequelize.define('UserXYZZ', { userCoolIdTag: { type: Sequelize.INTEGER, primaryKey: true }, username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZZ', { taskOrSomething: { type: Sequelize.INTEGER, primaryKey: true }, title: Sequelize.STRING });

      User.hasOne(Task, {foreignKey: 'userCoolIdTag'});

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({userCoolIdTag: 1, username: 'foo'}).success(function(user) {
            Task.create({taskOrSomething: 1, title: 'bar'}).success(function(task) {
              user.setTaskXYZZ(task).success(function() {
                user.getTaskXYZZ().success(function(task) {
                  expect(task).not.to.be.null;

                  user.setTaskXYZZ(null).success(function() {
                    user.getTaskXYZZ().success(function(_task) {
                      expect(_task).to.be.null;
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTaskXYZ(task).success(function() {
                user.getTaskXYZ().success(function(task) {
                  expect(task).not.to.equal(null);

                  user.setTaskXYZ(null).success(function() {
                    user.getTaskXYZ().success(function(task) {
                      expect(task).to.equal(null);
                      done();
                    });
                  });

                });
              });
            });
          });
        });
      });
    });

    it('supports passing the primary key instead of an object', function() {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({}).then(function(user) {
          return Task.create({ id: 19, title: 'task it!' }).then(function(task) {
            return user.setTaskXYZ(task.id).then(function() {
              return user.getTaskXYZ().then(function(task) {
                expect(task.title).to.equal('task it!');
              });
            });
          });
        });
      });
    });
  });

  describe('createAssociation', function() {
    it('creates an associated model instance', function(done) {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING });

      User.hasOne(Task);

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'bob' }).success(function(user) {
          user.createTask({ title: 'task' }).success(function() {
            user.getTask().success(function(task) {
              expect(task).not.to.be.null;
              expect(task.title).to.equal('task');

              done();
            });
          });
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Sequelize.STRING });

          User.hasOne(Group);

          sequelize.sync({ force: true }).success(function() {
            User.create({ username: 'bob' }).success(function(user) {
              sequelize.transaction().then(function(t) {
                user.createGroup({ name: 'testgroup' }, { transaction: t }).success(function() {
                  User.all().success(function(users) {
                    users[0].getGroup().success(function(group) {
                      expect(group).to.be.null;
                      User.all({ transaction: t }).success(function(users) {
                        users[0].getGroup({ transaction: t }).success(function(group) {
                          expect(group).to.be.not.null;
                          t.rollback().success(function() { done(); });
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
    }

  });

  describe('foreign key', function() {
    it('should lowercase foreign keys when using underscored', function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true });

      Account.hasOne(User);

      expect(User.rawAttributes.account_id).to.exist;
    });

    it('should use model name when using camelcase', function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false });

      Account.hasOne(User);

      expect(User.rawAttributes.AccountId).to.exist;
    });

    it('should support specifying the field of a foreign key', function() {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING })
        , self = this;

      Task.hasOne(User, {
        foreignKey: {
          name: 'taskId',
          field: 'task_id'
        }
      });

      expect(User.rawAttributes.taskId).to.exist;
      expect(User.rawAttributes.taskId.field).to.equal('task_id');
      return Task.sync({ force: true }).then(function() {
        // Can't use Promise.all cause of foreign key references
        return User.sync({ force: true });
      }).then(function() {
        return Promise.all([
          User.create({ username: 'foo', gender: 'male' }),
          Task.create({ title: 'task', status: 'inactive' })
        ]);
      }).spread(function(user, task) {
        return task.setUserXYZ(user).then(function() {
          return task.getUserXYZ();
        });
      }).then(function(user) {
        // the sql query should correctly look at task_id instead of taskId
        expect(user).to.not.be.null;
        return Task.find({
          where: {title: 'task'},
          include: [User]
        });
      }).then(function(task) {
        expect(task.UserXYZ).to.exist;
      });
    });
  });

  describe('foreign key constraints', function() {
    it('are enabled by default', function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task); // defaults to set NULL

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.destroy().success(function() {
                  task.reload().success(function() {
                    expect(task.UserId).to.equal(null);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should be possible to disable them', function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, { constraints: false });

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.destroy().success(function() {
                  task.reload().success(function() {
                    expect(task.UserId).to.equal(user.id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('can cascade deletes', function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, {onDelete: 'cascade'});

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                user.destroy().success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(0);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    // NOTE: mssql does not support changing an autoincrement primary key
    if (Support.getTestDialect() !== 'mssql') {
      it('can cascade updates', function(done) {
        var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
          , User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, {onUpdate: 'cascade'});

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                user.setTask(task).success(function() {

                  // Changing the id of a DAO requires a little dance since
                  // the `UPDATE` query generated by `save()` uses `id` in the
                  // `WHERE` clause

                  var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model);
                  user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                  .success(function() {
                    Task.findAll().success(function(tasks) {
                      expect(tasks).to.have.length(1);
                      expect(tasks[0].UserId).to.equal(999);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    }

    if (current.dialect.supports.constraints.restrict) {

      it('can restrict deletes', function(done) {
        var self = this;
        var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
          , User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, {onDelete: 'restrict'});

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                user.setTask(task).success(function() {
                  user.destroy().catch (self.sequelize.ForeignKeyConstraintError, function() {
                    // Should fail due to FK restriction
                    Task.findAll().success(function(tasks) {
                      expect(tasks).to.have.length(1);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('can restrict updates', function(done) {
        var self = this;
        var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
          , User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, {onUpdate: 'restrict'});

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                user.setTask(task).success(function() {

                  // Changing the id of a DAO requires a little dance since
                  // the `UPDATE` query generated by `save()` uses `id` in the
                  // `WHERE` clause

                  var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model);
                  user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                  .catch (self.sequelize.ForeignKeyConstraintError, function() {
                    // Should fail due to FK restriction
                    Task.findAll().success(function(tasks) {
                      expect(tasks).to.have.length(1);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });

    }

  });

  describe('Association column', function() {
    it('has correct type for non-id primary keys with non-integer type', function(done) {
      var User = this.sequelize.define('UserPKBT', {
        username: {
          type: Sequelize.STRING
        }
      })
        , self = this;

      var Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: Sequelize.STRING,
          primaryKey: true
        }
      });

      Group.hasOne(User);

      self.sequelize.sync({ force: true }).success(function() {
        expect(User.rawAttributes.GroupPKBTName.type.toString()).to.equal(Sequelize.STRING.toString());
        done();
      });
    });
  });

  describe('Association options', function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]
        , self = this
        , Tasks = {};

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString();
        Tasks[dataType] = self.sequelize.define(tableName, { title: Sequelize.STRING });

        User.hasOne(Tasks[dataType], { foreignKey: 'userId', keyType: dataType, constraints: false });

        Tasks[dataType].sync({ force: true }).success(function() {
          expect(Tasks[dataType].rawAttributes.userId.type.toString())
            .to.equal(dataType.toString());

          dataTypes.splice(dataTypes.indexOf(dataType), 1);
          if (!dataTypes.length) {
            done();
          }
        });
      });
    });

    describe('allows the user to provide an attribute definition object as foreignKey', function() {
      it('works with a column that hasnt been defined before', function() {
        var User = this.sequelize.define('user', {})
          , Profile = this.sequelize.define('project', {});

        User.hasOne(Profile, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Profile.rawAttributes.uid).to.be.defined;
        expect(Profile.rawAttributes.uid.references).to.equal(User.getTableName());
        expect(Profile.rawAttributes.uid.referencesKey).to.equal('id');
        expect(Profile.rawAttributes.uid.allowNull).to.be.false;

        // Let's clear it
        Profile = this.sequelize.define('project', {});
        User.hasOne(Profile, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Profile.rawAttributes.uid).to.be.defined;
        expect(Profile.rawAttributes.uid.references).to.equal(User.getTableName());
        expect(Profile.rawAttributes.uid.referencesKey).to.equal('id');
        expect(Profile.rawAttributes.uid.allowNull).to.be.false;
      });

      it('works when taking a column directly from the object', function() {
        var User = this.sequelize.define('user', {
              uid: {
                type: Sequelize.INTEGER,
                primaryKey: true
              }
            })
          , Profile = this.sequelize.define('project', {
              user_id: {
                type: Sequelize.INTEGER,
                allowNull: false
              }
            });

        User.hasOne(Profile, { foreignKey: Profile.rawAttributes.user_id});

        expect(Profile.rawAttributes.user_id).to.be.defined;
        expect(Profile.rawAttributes.user_id.references).to.equal(User.getTableName());
        expect(Profile.rawAttributes.user_id.referencesKey).to.equal('uid');
        expect(Profile.rawAttributes.user_id.allowNull).to.be.false;
      });

      it('works when merging with an existing definition', function() {
        var User = this.sequelize.define('user', {
              uid: {
                type: Sequelize.INTEGER,
                primaryKey: true
              }
            })
          , Project = this.sequelize.define('project', {
              userUid: {
                type: Sequelize.INTEGER,
                defaultValue: 42
              }
            });

        User.hasOne(Project, { foreignKey: { allowNull: false }});

        expect(Project.rawAttributes.userUid).to.be.defined;
        expect(Project.rawAttributes.userUid.allowNull).to.be.false;
        expect(Project.rawAttributes.userUid.references).to.equal(User.getTableName());
        expect(Project.rawAttributes.userUid.referencesKey).to.equal('uid');
        expect(Project.rawAttributes.userUid.defaultValue).to.equal(42);
      });
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
      var User = this.sequelize.define('user', {
            attribute: Sequelize.STRING
          })
        , Attribute = this.sequelize.define('attribute', {});

        expect(User.hasOne.bind(User, Attribute)).to
        .throw ("Naming collision between attribute 'attribute' and association 'attribute' on model user. To remedy this, change either foreignKey or as in your association definition");
    });
  });

  describe('Counter part', function() {
    describe('BelongsTo', function() {
      it('should only generate one foreign key', function() {
        var Orders = this.sequelize.define('Orders', {}, {timestamps: false})
          , InternetOrders = this.sequelize.define('InternetOrders', {}, {timestamps: false});

        InternetOrders.belongsTo(Orders, {
          foreignKeyConstraint: true
        });
        Orders.hasOne(InternetOrders, {
          foreignKeyConstraint: true
        });

        expect(Object.keys(InternetOrders.rawAttributes).length).to.equal(2);
        expect(InternetOrders.rawAttributes.OrderId).to.be.ok;
        expect(InternetOrders.rawAttributes.OrdersId).not.to.be.ok;
      });
    });
  });
});
