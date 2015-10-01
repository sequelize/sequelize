'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('BelongsTo'), function() {
  describe('Model.associations', function() {
    it('should store all assocations when associting to the same table multiple times', function() {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Group.belongsTo(User);
      Group.belongsTo(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.belongsTo(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(Object.keys(Group.associations)).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('getAssociation', function() {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(function (sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          return sequelize.sync({ force: true }).then(function() {
            return User.create({ username: 'foo' }).then(function(user) {
              return Group.create({ name: 'bar' }).then(function(group) {
                return sequelize.transaction().then(function(t) {
                  return group.setUser(user, { transaction: t }).then(function() {
                    return Group.all().then(function(groups) {
                      return groups[0].getUser().then(function(associatedUser) {
                        expect(associatedUser).to.be.null;
                        return Group.all({ transaction: t }).then(function(groups) {
                          return groups[0].getUser({ transaction: t }).then(function(associatedUser) {
                            expect(associatedUser).to.be.not.null;
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
    }

    it('does not modify the passed arguments', function() {
      var User = this.sequelize.define('user', {})
        , Project = this.sequelize.define('project', {});

      User.belongsTo(Project);

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
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      Task.belongsTo(User);

      return User.sync({ force: true }).then(function() {
        // Can't use Promise.all cause of foreign key references
        return Task.sync({ force: true });
      }).then(function() {
        return Promise.all([
          User.create({ username: 'foo', gender: 'male' }),
          User.create({ username: 'bar', gender: 'female' }),
          Task.create({ title: 'task', status: 'inactive' })
        ]);
      }).spread(function(userA, userB, task) {
        return task.setUserXYZ(userA).then(function() {
          return task.getUserXYZ({where: ['gender = ?', 'female']});
        });
      }).then(function(user) {
        expect(user).to.be.null;
      });
    });

    it('supports schemas', function() {
      var User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }).schema('archive')
        , Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING }).schema('archive')
        , self = this;

      Task.belongsTo(User);

      return self.sequelize.dropAllSchemas().then(function() {
        return self.sequelize.createSchema('archive');
      }).then(function() {
        return User.sync({force: true });
      }).then(function() {
        return Task.sync({force: true });
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
        expect(user).to.be.ok;
      });
    });

    it('should support logging', function () {
      var spy = sinon.spy();

       var User = this.sequelize.define('user', {})
        , Project = this.sequelize.define('project', {});

      User.belongsTo(Project);

      return this.sequelize.sync({ force: true }).bind(this).then(function() {
        return User.create({});
      }).then(function(user) {
        return user.getProject({
          logging: spy
        });
      }).then(function() {
        expect(spy.called).to.be.ok;
      });
    });
  });

  describe('setAssociation', function() {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(function (sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

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

    it('can set the association with declared primary keys...', function() {
      var User = this.sequelize.define('UserXYZ', { user_id: {type: DataTypes.INTEGER, primaryKey: true }, username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { task_id: {type: DataTypes.INTEGER, primaryKey: true }, title: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: 'user_id' });

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ user_id: 1, username: 'foo' }).then(function(user) {
          return Task.create({ task_id: 1, title: 'task' }).then(function(task) {
            return task.setUserXYZ(user).then(function() {
              return task.getUserXYZ().then(function(user) {
                expect(user).not.to.be.null;

                return task.setUserXYZ(null).then(function() {
                  return task.getUserXYZ().then(function(user) {
                    expect(user).to.be.null;
                  });
                });
              });
            });
          });
        });
      });
    });

    it('clears the association if null is passed', function() {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' }).then(function(user) {
          return Task.create({ title: 'task' }).then(function(task) {
            return task.setUserXYZ(user).then(function() {
              return task.getUserXYZ().then(function(user) {
                expect(user).not.to.be.null;

                return task.setUserXYZ(null).then(function() {
                  return task.getUserXYZ().then(function(user) {
                    expect(user).to.be.null;
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should throw a ForeignKeyConstraintError if the associated record does not exist', function() {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(function() {
        return expect(Task.create({ title: 'task', UserXYZId: 5 })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(function () {
          return Task.create({ title: 'task' }).then(function(task) {
            return expect(Task.update({ title: 'taskUpdate', UserXYZId: 5 }, { where: { id: task.id } })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
          });
        });
      });
    });

    it('supports passing the primary key instead of an object', function() {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ id: 15, username: 'jansemand' }).then(function(user) {
          return Task.create({}).then(function(task) {
            return task.setUserXYZ(user.id).then(function() {
              return task.getUserXYZ().then(function(user) {
                expect(user.username).to.equal('jansemand');
              });
            });
          });
        });
      });
    });

    it('should support logging', function() {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING })
        , spy = sinon.spy();

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create().then(function(user) {
          return Task.create({}).then(function(task) {
            return task.setUserXYZ(user, {logging: spy}).then(function() {
              expect(spy.called).to.be.ok;
            });
          });
        });
      });
    });

    it('should not clobber atributes', function() {
      var Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      var Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasOne(Comment);
      Comment.belongsTo(Post);

      return this.sequelize.sync().then(function() {
        return Post.create({
          title: 'Post title'
        }).then(function(post) {
          return Comment.create({
            text: 'OLD VALUE'
          }).then(function(comment) {
            comment.text = 'UPDATED VALUE';
            return comment.setPost(post).then(function() {
              expect(comment.text).to.equal('UPDATED VALUE');
            });
          });
        });
      });
    });

    it('should set the foreign key value without saving when using save: false', function () {
      var Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      var Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasMany(Comment, {foreignKey: 'post_id'});
      Comment.belongsTo(Post, {foreignKey: 'post_id'});

      return this.sequelize.sync({force: true}).then(function () {
        return Promise.join(
          Post.create(),
          Comment.create()
        ).spread(function (post, comment) {
          expect(comment.get('post_id')).not.to.be.ok;

          var setter = comment.setPost(post, {save: false});

          expect(setter).to.be.undefined;
          expect(comment.get('post_id')).to.equal(post.get('id'));
          expect(comment.changed('post_id')).to.be.true;
        });
      });
    });
  });

  describe('createAssociation', function() {
    it('creates an associated model instance', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(function() {
        return Task.create({ title: 'task' }).then(function(task) {
          return task.createUser({ username: 'bob' }).then(function() {
            return task.getUser().then(function(user) {
              expect(user).not.to.be.null;
              expect(user.username).to.equal('bob');
            });
          });
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(function (sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          return sequelize.sync({ force: true }).then(function() {
            return Group.create({ name: 'bar' }).then(function(group) {
              return sequelize.transaction().then(function(t) {
                return group.createUser({ username: 'foo' }, { transaction: t }).then(function() {
                  return group.getUser().then(function(user) {
                    expect(user).to.be.null;

                    return group.getUser({ transaction: t }).then(function(user) {
                      expect(user).not.to.be.null;

                      return t.rollback();
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

      User.belongsTo(Account);

      expect(User.rawAttributes.account_id).to.exist;
    });

    it('should use model name when using camelcase', function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false })
        , Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false });

      User.belongsTo(Account);

      expect(User.rawAttributes.AccountId).to.exist;
    });

    it('should support specifying the field of a foreign key', function() {
       var User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false })
         , Account = this.sequelize.define('Account', { title: Sequelize.STRING }, { underscored: false });

      User.belongsTo(Account, {
        foreignKey: {
          name: 'AccountId',
          field: 'account_id'
        }
      });

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('account_id');

      return Account.sync({ force: true }).then(function() {
        // Can't use Promise.all cause of foreign key references
        return User.sync({ force: true });
      }).then(function() {
        return Promise.all([
          User.create({ username: 'foo' }),
          Account.create({ title: 'pepsico' })
        ]);
      }).spread(function(user, account) {
        return user.setAccount(account).then(function() {
          return user.getAccount();
        });
      }).then(function(user) {
        // the sql query should correctly look at task_id instead of taskId
        expect(user).to.not.be.null;
        return User.findOne({
          where: {username: 'foo'},
          include: [Account]
        });
      }).then(function(task) {
        expect(task.Account).to.exist;
      });
    });
  });

  describe('foreign key constraints', function() {
    it('are enabled by default', function() {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User); // defaults to SET NULL

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' }).then(function(user) {
          return Task.create({ title: 'task' }).then(function(task) {
            return task.setUser(user).then(function() {
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

    it('sets to NO ACTION if allowNull: false', function() {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: { allowNull: false }}); // defaults to NO ACTION

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' }).then(function(user) {
          return Task.create({ title: 'task', UserId: user.id }).then(function(task) {
            return expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(function () {
              return Task.findAll().then(function(tasks) {
                expect(tasks).to.have.length(1);
              });
            });
          });
        });
      });
    });

    it('should be possible to disable them', function() {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      Task.belongsTo(User, { constraints: false });

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' }).then(function(user) {
          return Task.create({ title: 'task' }).then(function(task) {
            return task.setUser(user).then(function() {
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

    it('can cascade deletes', function() {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, {onDelete: 'cascade'});

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' }).then(function(user) {
          return Task.create({ title: 'task' }).then(function(task) {
            return task.setUser(user).then(function() {
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

    if (current.dialect.supports.constraints.restrict) {
      it('can restrict deletes', function() {
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onDelete: 'restrict'});

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return task.setUser(user).then(function() {
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

      it('can restrict updates', function() {
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onUpdate: 'restrict'});

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return task.setUser(user).then(function() {

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

    }

    // NOTE: mssql does not support changing an autoincrement primary key
    if (Support.getTestDialect() !== 'mssql') {
      it('can cascade updates', function() {
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onUpdate: 'cascade'});

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({ username: 'foo' }).then(function(user) {
            return Task.create({ title: 'task' }).then(function(task) {
              return task.setUser(user).then(function() {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.Model);
                return user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id})
                .then(function() {
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
    }

  });

  describe('Association column', function() {
    it('has correct type and name for non-id primary keys with non-integer type', function() {
      var User = this.sequelize.define('UserPKBT', {
        username: {
          type: DataTypes.STRING
        }
      })
        , self = this;

      var Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      });

      User.belongsTo(Group);

      return self.sequelize.sync({ force: true }).then(function() {
        expect(User.rawAttributes.GroupPKBTName.type).to.an.instanceof(DataTypes.STRING);
      });
    });

    it('should support a non-primary key as the association column on a target without a primary key', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username'});

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'bob' }).then(function(newUser) {
          return Task.create({ title: 'some task' }).then(function(newTask) {
            return newTask.setUser(newUser).then(function() {
              return Task.findOne({title: 'some task'}).then(function (foundTask) {
                return foundTask.getUser().then(function (foundUser) {
                  expect(foundUser.username).to.equal('bob');
                });
              });
            });
          });
        });
      });
    });

    it('should support a non-primary unique key as the association column', function() {
      var User = this.sequelize.define('User', {
            username: {
              type: DataTypes.STRING,
              field: 'user_name',
              unique: true
            }
          })
        , Task = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username'});

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'bob' }).then(function(newUser) {
          return Task.create({ title: 'some task' }).then(function(newTask) {
            return newTask.setUser(newUser).then(function() {
              return Task.findOne({title: 'some task'}).then(function (foundTask) {
                return foundTask.getUser().then(function (foundUser) {
                  expect(foundUser.username).to.equal('bob');
                });
              });
            });
          });
        });
      });
    });

    it('should support a non-primary key as the association column with a field option', function() {
      var User = this.sequelize.define('User', {
          username: {
            type:  DataTypes.STRING,
            field: 'the_user_name_field'
          }
        })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username'});

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'bob' }).then(function(newUser) {
          return Task.create({ title: 'some task' }).then(function(newTask) {
            return newTask.setUser(newUser).then(function() {
              return Task.findOne({title: 'some task'}).then(function (foundTask) {
                return foundTask.getUser().then(function (foundUser) {
                  expect(foundUser.username).to.equal('bob');
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Association options', function() {
    it('can specify data type for autogenerated relational keys', function() {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , dataTypes = [DataTypes.INTEGER, DataTypes.BIGINT, DataTypes.STRING]
        , self = this
        , Tasks = {};

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.key;
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING });

        Tasks[dataType].belongsTo(User, { foreignKey: 'userId', keyType: dataType, constraints: false });
      });

      return self.sequelize.sync({ force: true }).then(function() {
        dataTypes.forEach(function(dataType) {
          expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
        });
      });
    });

    describe('allows the user to provide an attribute definition object as foreignKey', function() {
      it('works with a column that hasnt been defined before', function() {
        var Task = this.sequelize.define('task', {})
          , User = this.sequelize.define('user', {});

        Task.belongsTo(User, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Task.rawAttributes.uid).to.be.ok;
        expect(Task.rawAttributes.uid.allowNull).to.be.false;
        expect(Task.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Task.rawAttributes.uid.references.key).to.equal('id');
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

        Profile.belongsTo(User, { foreignKey: Profile.rawAttributes.user_id});

        expect(Profile.rawAttributes.user_id).to.be.ok;
        expect(Profile.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.user_id.references.key).to.equal('uid');
        expect(Profile.rawAttributes.user_id.allowNull).to.be.false;
      });

      it('works when merging with an existing definition', function() {
        var Task = this.sequelize.define('task', {
            projectId: {
              defaultValue: 42,
              type: Sequelize.INTEGER
            }
          })
          , Project = this.sequelize.define('project', {});

        Task.belongsTo(Project, { foreignKey: { allowNull: true }});

        expect(Task.rawAttributes.projectId).to.be.ok;
        expect(Task.rawAttributes.projectId.defaultValue).to.equal(42);
        expect(Task.rawAttributes.projectId.allowNull).to.be.ok;
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      var Person = this.sequelize.define('person', {})
        , Car = this.sequelize.define('car', {});

      expect(Car.belongsTo.bind(Car, Person, {foreignKey: 'person'})).to
        .throw ('Naming collision between attribute \'person\' and association \'person\' on model car. To remedy this, change either foreignKey or as in your association definition');
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
       var Person = this.sequelize.define('person', {})
        , Car = this.sequelize.define('car', {
            person: Sequelize.INTEGER
          });

        expect(Car.belongsTo.bind(Car, Person, {as: 'person'})).to
        .throw ('Naming collision between attribute \'person\' and association \'person\' on model car. To remedy this, change either foreignKey or as in your association definition');
    });
  });
});
