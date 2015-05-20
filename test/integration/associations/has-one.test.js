'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , current = Support.sequelize;

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
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(function (sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.hasOne(User);

          return sequelize.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(fakeUser) {
              return User.create({ username: 'foo' }).then(function(user) {
                return Group.create({ name: 'bar' }).then(function(group) {
                  return sequelize.transaction().then(function(t) {
                    return group.setUser(user, { transaction: t }).then(function() {
                      return Group.all().then(function(groups) {
                        return groups[0].getUser().then(function(associatedUser) {
                          expect(associatedUser).to.be.null;
                          return Group.all({ transaction: t }).then(function(groups) {
                            return groups[0].getUser({ transaction: t }).then(function(associatedUser) {
                              expect(associatedUser).not.to.be.null;
                              expect(associatedUser.id).to.equal(user.id);
                              expect(associatedUser.id).not.to.equal(fakeUser.id);
                              return t.rollback();
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

    it('should be able to handle a where object that\'s a first class citizen.', function() {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      User.hasOne(Task);

      return User.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task', status: 'inactive' }).then(function(task) {
              return user.setTaskXYZ(task).then(function() {
                return user.getTaskXYZ({where: ['status = ?', 'active']}).then(function(task) {
                  expect(task).to.be.null;
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
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.hasOne(User);

          return sequelize.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return Group.create({ name: 'bar' }).then(function(group) {
                return sequelize.transaction().then(function(t) {
                  return group.setUser(user, { transaction: t }).then(function() {
                    return Group.all().then(function(groups) {
                      return groups[0].getUser().then(function(associatedUser) {
                        expect(associatedUser).to.be.null;
                        return t.rollback();
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

    it('can set an association with predefined primary keys', function() {
      var User = this.sequelize.define('UserXYZZ', { userCoolIdTag: { type: Sequelize.INTEGER, primaryKey: true }, username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZZ', { taskOrSomething: { type: Sequelize.INTEGER, primaryKey: true }, title: Sequelize.STRING });

      User.hasOne(Task, {foreignKey: 'userCoolIdTag'});

      return User.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return User.create({userCoolIdTag: 1, username: 'foo'}).then(function(user) {
            return Task.create({taskOrSomething: 1, title: 'bar'}).then(function(task) {
              return user.setTaskXYZZ(task).then(function() {
                return user.getTaskXYZZ().then(function(task) {
                  expect(task).not.to.be.null;

                  return user.setTaskXYZZ(null).then(function() {
                    return user.getTaskXYZZ().then(function(_task) {
                      expect(_task).to.be.null;
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('clears the association if null is passed', function() {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      return User.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return user.setTaskXYZ(task).then(function() {
                return user.getTaskXYZ().then(function(task) {
                  expect(task).not.to.equal(null);

                  return user.setTaskXYZ(null).then(function() {
                    return user.getTaskXYZ().then(function(task) {
                      expect(task).to.equal(null);
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
    it('creates an associated model instance', function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING });

      User.hasOne(Task);

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'bob' }).then(function(user) {
          return user.createTask({ title: 'task' }).then(function() {
            return user.getTask().then(function(task) {
              expect(task).not.to.be.null;
              expect(task.title).to.equal('task');
            });
          });
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(function(sequelize) {
          var User = sequelize.define('User', { username: Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Sequelize.STRING });

          User.hasOne(Group);

          return sequelize.sync({ force: true }).then(function() {
            return User.create({ username: 'bob' }).then(function(user) {
              return sequelize.transaction().then(function(t) {
                return user.createGroup({ name: 'testgroup' }, { transaction: t }).then(function() {
                  return User.all().then(function(users) {
                    return users[0].getGroup().then(function(group) {
                      expect(group).to.be.null;
                      return User.all({ transaction: t }).then(function(users) {
                        return users[0].getGroup({ transaction: t }).then(function(group) {
                          expect(group).to.be.not.null;
                          return t.rollback();
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
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

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
        return Task.findOne({
          where: {title: 'task'},
          include: [User]
        });
      }).then(function(task) {
        expect(task.UserXYZ).to.exist;
      });
    });
  });

  describe('foreign key constraints', function() {
    it('are enabled by default', function() {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task); // defaults to set NULL

      return User.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return user.setTask(task).then(function() {
                return user.destroy().then(function() {
                  return task.reload().then(function() {
                    expect(task.UserId).to.equal(null);
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should be possible to disable them', function() {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, { constraints: false });

      return User.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return user.setTask(task).then(function() {
                return user.destroy().then(function() {
                  return task.reload().then(function() {
                    expect(task.UserId).to.equal(user.id);
                  });
                });
              });
            });
          });
        });
      });
    });

    it('can cascade deletes', function() {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, {onDelete: 'cascade'});

      return User.sync({ force: true }).then(function() {
        return Task.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return user.setTask(task).then(function() {
                return user.destroy().then(function() {
                  return Task.findAll().then(function(tasks) {
                    expect(tasks).to.have.length(0);
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
      it('can cascade updates', function() {
        var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
          , User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, {onUpdate: 'cascade'});

        return User.sync({ force: true }).then(function() {
          return Task.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return Task.create({ title: 'task' }).then(function(task) {
                return user.setTask(task).then(function() {

                  // Changing the id of a DAO requires a little dance since
                  // the `UPDATE` query generated by `save()` uses `id` in the
                  // `WHERE` clause

                  var tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.Model);
                  return user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id}).then(function() {
                    return Task.findAll().then(function(tasks) {
                      expect(tasks).to.have.length(1);
                      expect(tasks[0].UserId).to.equal(999);
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

      it('can restrict deletes', function() {
        var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
          , User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, {onDelete: 'restrict'});

        return User.sync({ force: true }).then(function() {
          return Task.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return Task.create({ title: 'task' }).then(function(task) {
                return user.setTask(task).then(function() {
                  return expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(function () {
                    return Task.findAll().then(function(tasks) {
                      expect(tasks).to.have.length(1);
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('can restrict updates', function() {
        var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
          , User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, {onUpdate: 'restrict'});

        return User.sync({ force: true }).then(function() {
          return Task.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return Task.create({ title: 'task' }).then(function(task) {
                return user.setTask(task).then(function() {

                  // Changing the id of a DAO requires a little dance since
                  // the `UPDATE` query generated by `save()` uses `id` in the
                  // `WHERE` clause

                  var tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.Model);
                  return expect(
                    user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id})
                  ).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(function () {
                    // Should fail due to FK restriction
                    return Task.findAll().then(function(tasks) {
                      expect(tasks).to.have.length(1);
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
    it('has correct type for non-id primary keys with non-integer type', function() {
      var User = this.sequelize.define('UserPKBT', {
        username: {
          type: Sequelize.STRING
        }
      });

      var Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: Sequelize.STRING,
          primaryKey: true
        }
      });

      Group.hasOne(User);

      return this.sequelize.sync({ force: true }).then(function() {
        expect(User.rawAttributes.GroupPKBTName.type).to.an.instanceof(Sequelize.STRING);
      });
    });
  });

  describe('Association options', function() {
    it('can specify data type for autogenerated relational keys', function() {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]
        , self = this
        , Tasks = {};

      return Promise.map(dataTypes, function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.key;
        Tasks[dataType] = self.sequelize.define(tableName, { title: Sequelize.STRING });

        User.hasOne(Tasks[dataType], { foreignKey: 'userId', keyType: dataType, constraints: false });

        return Tasks[dataType].sync({ force: true }).then(function() {
          expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
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

        expect(Profile.rawAttributes.uid).to.be.ok;
        expect(Profile.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.uid.references.key).to.equal('id');
        expect(Profile.rawAttributes.uid.allowNull).to.be.false;

        // Let's clear it
        Profile = this.sequelize.define('project', {});
        User.hasOne(Profile, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Profile.rawAttributes.uid).to.be.ok;
        expect(Profile.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.uid.references.key).to.equal('id');
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

        expect(Profile.rawAttributes.user_id).to.be.ok;
        expect(Profile.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.user_id.references.key).to.equal('uid');
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

        expect(Project.rawAttributes.userUid).to.be.ok;
        expect(Project.rawAttributes.userUid.allowNull).to.be.false;
        expect(Project.rawAttributes.userUid.references.model).to.equal(User.getTableName());
        expect(Project.rawAttributes.userUid.references.key).to.equal('uid');
        expect(Project.rawAttributes.userUid.defaultValue).to.equal(42);
      });
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
      var User = this.sequelize.define('user', {
            attribute: Sequelize.STRING
          })
        , Attribute = this.sequelize.define('attribute', {});

        expect(User.hasOne.bind(User, Attribute)).to
        .throw ('Naming collision between attribute \'attribute\' and association \'attribute\' on model user. To remedy this, change either foreignKey or as in your association definition');
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
