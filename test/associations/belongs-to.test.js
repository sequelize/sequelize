'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , Sequelize = require('../../index')
  , Promise = Sequelize.Promise
  , assert = require('assert')
  , current = Support.sequelize;

chai.config.includeStack = true;

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
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          sequelize.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Group.create({ name: 'bar' }).success(function(group) {
                sequelize.transaction().then(function(t) {
                  group.setUser(user, { transaction: t }).success(function() {
                    Group.all().success(function(groups) {
                      groups[0].getUser().success(function(associatedUser) {
                        expect(associatedUser).to.be.null;
                        Group.all({ transaction: t }).success(function(groups) {
                          groups[0].getUser({ transaction: t }).success(function(associatedUser) {
                            expect(associatedUser).to.be.not.null;
                            t.rollback().success(function() {
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
        return self.sequelize.sync({force: true });
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
  });

  describe('setAssociation', function() {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          sequelize.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Group.create({ name: 'bar' }).success(function(group) {
                sequelize.transaction().then(function(t) {
                  group.setUser(user, { transaction: t }).success(function() {
                    Group.all().success(function(groups) {
                      groups[0].getUser().success(function(associatedUser) {
                        expect(associatedUser).to.be.null;
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
    }

    it('can set the association with declared primary keys...', function(done) {
      var User = this.sequelize.define('UserXYZ', { user_id: {type: DataTypes.INTEGER, primaryKey: true }, username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { task_id: {type: DataTypes.INTEGER, primaryKey: true }, title: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: 'user_id' });

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ user_id: 1, username: 'foo' }).success(function(user) {
          Task.create({ task_id: 1, title: 'task' }).success(function(task) {
            task.setUserXYZ(user).success(function() {
              task.getUserXYZ().success(function(user) {
                expect(user).not.to.be.null;

                task.setUserXYZ(null).success(function() {
                  task.getUserXYZ().success(function(user) {
                    expect(user).to.be.null;
                    done();
                  });
                });

              });
            });
          });
        });
      });
    });

    it('clears the association if null is passed', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUserXYZ(user).success(function() {
              task.getUserXYZ().success(function(user) {
                expect(user).not.to.be.null;

                task.setUserXYZ(null).success(function() {
                  task.getUserXYZ().success(function(user) {
                    expect(user).to.be.null;
                    done();
                  });
                });

              });
            });
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

    it('should not clobber atributes', function(done) {
      var Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      var Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasOne(Comment);
      Comment.belongsTo(Post);

      this.sequelize.sync().done(function() {
        Post.create({
          title: 'Post title'
        }).done(function(err, post) {
          Comment.create({
            text: 'OLD VALUE'
          }).done(function(err, comment) {
            comment.setPost(post).done(function() {
              expect(comment.text).to.equal('UPDATED VALUE');
              done();
            });

            comment.text = 'UPDATED VALUE';
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
    it('creates an associated model instance', function(done) {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.belongsTo(User);

      this.sequelize.sync({ force: true }).success(function() {
        Task.create({ title: 'task' }).success(function(task) {
          task.createUser({ username: 'bob' }).success(function() {
            task.getUser().success(function(user) {
              expect(user).not.to.be.null;
              expect(user.username).to.equal('bob');

              done();
            });
          });
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: Support.Sequelize.STRING })
            , Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          sequelize.sync({ force: true }).success(function() {
            Group.create({ name: 'bar' }).success(function(group) {
              sequelize.transaction().then(function(t) {
                group.createUser({ username: 'foo' }, { transaction: t }).success(function() {
                  group.getUser().success(function(user) {
                    expect(user).to.be.null;

                    group.getUser({ transaction: t }).success(function(user) {
                      expect(user).not.to.be.null;

                      t.rollback().success(function() { done(); });
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
        return User.find({
          where: {username: 'foo'},
          include: [Account]
        });
      }).then(function(task) {
        expect(task.Account).to.exist;
      });
    });
  });

  describe('foreign key constraints', function() {
    it('are enabled by default', function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User); // defaults to SET NULL

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
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

    it('should be possible to disable them', function(done) {
      var Task = this.sequelize.define('Task', { title: Sequelize.STRING })
        , User = this.sequelize.define('User', { username: Sequelize.STRING });

      Task.belongsTo(User, { constraints: false });

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
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

    it('can cascade deletes', function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, {onDelete: 'cascade'});

      this.sequelize.sync({ force: true }).success(function() {
        User.create({ username: 'foo' }).success(function(user) {
          Task.create({ title: 'task' }).success(function(task) {
            task.setUser(user).success(function() {
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

    if (current.dialect.supports.constraints.restrict) {
      it('can restrict deletes', function(done) {
        var self = this;
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onDelete: 'restrict'});

        this.sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              task.setUser(user).success(function() {
                // Should fail due to FK restriction
                user.destroy().catch (self.sequelize.ForeignKeyConstraintError, function(err) {
                  expect(err).to.be.ok;
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

      it('can restrict updates', function(done) {
        var self = this;
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onUpdate: 'restrict'});

        this.sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              task.setUser(user).success(function() {

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

    }

    // NOTE: mssql does not support changing an autoincrement primary key
    if (Support.getTestDialect() !== 'mssql') {
      it('can cascade updates', function(done) {
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onUpdate: 'cascade'});

        this.sequelize.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              task.setUser(user).success(function() {

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
    }

  });

  describe('Association column', function() {
    it('has correct type and name for non-id primary keys with non-integer type', function(done) {
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

      self.sequelize.sync({ force: true }).success(function() {
        expect(User.rawAttributes.GroupPKBTName.type.toString()).to.equal(DataTypes.STRING.toString());
        done();
      });
    });
  });

  describe('Association options', function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , dataTypes = [DataTypes.INTEGER, DataTypes.BIGINT, DataTypes.STRING]
        , self = this
        , Tasks = {};

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString();
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING });

        Tasks[dataType].belongsTo(User, { foreignKey: 'userId', keyType: dataType, constraints: false });
      });

      self.sequelize.sync({ force: true })
      .success(function() {
        dataTypes.forEach(function(dataType, i) {
          expect(Tasks[dataType].rawAttributes.userId.type.toString())
            .to.equal(dataType.toString());

          if ((i + 1) === dataTypes.length) {
            done();
          }
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

        expect(Task.rawAttributes.uid).to.be.defined;
        expect(Task.rawAttributes.uid.allowNull).to.be.false;
        expect(Task.rawAttributes.uid.references).to.equal(User.getTableName());
        expect(Task.rawAttributes.uid.referencesKey).to.equal('id');
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

        expect(Profile.rawAttributes.user_id).to.be.defined;
        expect(Profile.rawAttributes.user_id.references).to.equal(User.getTableName());
        expect(Profile.rawAttributes.user_id.referencesKey).to.equal('uid');
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

        expect(Task.rawAttributes.projectId).to.be.defined;
        expect(Task.rawAttributes.projectId.defaultValue).to.equal(42);
        expect(Task.rawAttributes.projectId.allowNull).to.be.ok;
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      var Person = this.sequelize.define('person', {})
        , Car = this.sequelize.define('car', {});

      expect(Car.belongsTo.bind(Car, Person, {foreignKey: 'person'})).to
        .throw ("Naming collision between attribute 'person' and association 'person' on model car. To remedy this, change either foreignKey or as in your association definition");
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
       var Person = this.sequelize.define('person', {})
        , Car = this.sequelize.define('car', {
            person: Sequelize.INTEGER
          });

        expect(Car.belongsTo.bind(Car, Person, {as: 'person'})).to
        .throw ("Naming collision between attribute 'person' and association 'person' on model car. To remedy this, change either foreignKey or as in your association definition");
    });
  });
});
