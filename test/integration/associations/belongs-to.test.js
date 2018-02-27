'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  current = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('BelongsTo'), () => {
  describe('Model.associations', () => {
    it('should store all assocations when associting to the same table multiple times', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      Group.belongsTo(User);
      Group.belongsTo(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.belongsTo(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(Object.keys(Group.associations)).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('get', () => {
    describe('multiple', () => {
      it('should fetch associations for multiple instances', function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {});

        Task.User = Task.belongsTo(User, {as: 'user'});

        return this.sequelize.sync({force: true}).then(() => {
          return Promise.join(
            Task.create({
              id: 1,
              user: {id: 1}
            }, {
              include: [Task.User]
            }),
            Task.create({
              id: 2,
              user: {id: 2}
            }, {
              include: [Task.User]
            }),
            Task.create({
              id: 3
            })
          );
        }).then(tasks => {
          return Task.User.get(tasks).then(result => {
            expect(result[tasks[0].id].id).to.equal(tasks[0].user.id);
            expect(result[tasks[1].id].id).to.equal(tasks[1].user.id);
            expect(result[tasks[2].id]).to.be.undefined;
          });
        });
      });
    });
  });

  describe('getAssociation', () => {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
            Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          return sequelize.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(user => {
              return Group.create({ name: 'bar' }).then(group => {
                return sequelize.transaction().then(t => {
                  return group.setUser(user, { transaction: t }).then(() => {
                    return Group.all().then(groups => {
                      return groups[0].getUser().then(associatedUser => {
                        expect(associatedUser).to.be.null;
                        return Group.all({ transaction: t }).then(groups => {
                          return groups[0].getUser({ transaction: t }).then(associatedUser => {
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

    it('should be able to handle a where object that\'s a first class citizen.', function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      Task.belongsTo(User);

      return User.sync({ force: true }).then(() => {
        // Can't use Promise.all cause of foreign key references
        return Task.sync({ force: true });
      }).then(() => {
        return Promise.all([
          User.create({ username: 'foo', gender: 'male' }),
          User.create({ username: 'bar', gender: 'female' }),
          Task.create({ title: 'task', status: 'inactive' })
        ]);
      }).spread((userA, userB, task) => {
        return task.setUserXYZ(userA).then(() => {
          return task.getUserXYZ({where: {gender: 'female'}});
        });
      }).then(user => {
        expect(user).to.be.null;
      });
    });

    it('supports schemas', function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }).schema('archive'),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING }).schema('archive');

      Task.belongsTo(User);

      return this.sequelize.dropAllSchemas().then(() => {
        return this.sequelize.createSchema('archive');
      }).then(() => {
        return User.sync({force: true });
      }).then(() => {
        return Task.sync({force: true });
      }).then(() => {
        return Promise.all([
          User.create({ username: 'foo', gender: 'male' }),
          Task.create({ title: 'task', status: 'inactive' })
        ]);
      }).spread((user, task) => {
        return task.setUserXYZ(user).then(() => {
          return task.getUserXYZ();
        });
      }).then(user => {
        expect(user).to.be.ok;
        return this.sequelize.dropSchema('archive').then(() => {
          return this.sequelize.showAllSchemas().then(schemas => {
            if (dialect === 'postgres' || dialect === 'mssql') {
              expect(schemas).to.be.empty;
            }
          });
        });
      });
    });
  });

  describe('setAssociation', () => {

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
            Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          return sequelize.sync({ force: true }).then(() => {
            return User.create({ username: 'foo' }).then(user => {
              return Group.create({ name: 'bar' }).then(group => {
                return sequelize.transaction().then(t => {
                  return group.setUser(user, { transaction: t }).then(() => {
                    return Group.all().then(groups => {
                      return groups[0].getUser().then(associatedUser => {
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
      const User = this.sequelize.define('UserXYZ', { user_id: {type: DataTypes.INTEGER, primaryKey: true }, username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { task_id: {type: DataTypes.INTEGER, primaryKey: true }, title: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: 'user_id' });

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ user_id: 1, username: 'foo' }).then(user => {
          return Task.create({ task_id: 1, title: 'task' }).then(task => {
            return task.setUserXYZ(user).then(() => {
              return task.getUserXYZ().then(user => {
                expect(user).not.to.be.null;

                return task.setUserXYZ(null).then(() => {
                  return task.getUserXYZ().then(user => {
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
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'foo' }).then(user => {
          return Task.create({ title: 'task' }).then(task => {
            return task.setUserXYZ(user).then(() => {
              return task.getUserXYZ().then(user => {
                expect(user).not.to.be.null;

                return task.setUserXYZ(null).then(() => {
                  return task.getUserXYZ().then(user => {
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
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(() => {
        return expect(Task.create({ title: 'task', UserXYZId: 5 })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(() => {
          return Task.create({ title: 'task' }).then(task => {
            return expect(Task.update({ title: 'taskUpdate', UserXYZId: 5 }, { where: { id: task.id } })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
          });
        });
      });
    });

    it('supports passing the primary key instead of an object', function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ id: 15, username: 'jansemand' }).then(user => {
          return Task.create({}).then(task => {
            return task.setUserXYZ(user.id).then(() => {
              return task.getUserXYZ().then(user => {
                expect(user.username).to.equal('jansemand');
              });
            });
          });
        });
      });
    });

    it('should support logging', function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING }),
        spy = sinon.spy();

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create().then(user => {
          return Task.create({}).then(task => {
            return task.setUserXYZ(user, {logging: spy}).then(() => {
              expect(spy.called).to.be.ok;
            });
          });
        });
      });
    });

    it('should not clobber atributes', function() {
      const Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasOne(Comment);
      Comment.belongsTo(Post);

      return this.sequelize.sync().then(() => {
        return Post.create({
          title: 'Post title'
        }).then(post => {
          return Comment.create({
            text: 'OLD VALUE'
          }).then(comment => {
            comment.text = 'UPDATED VALUE';
            return comment.setPost(post).then(() => {
              expect(comment.text).to.equal('UPDATED VALUE');
            });
          });
        });
      });
    });

    it('should set the foreign key value without saving when using save: false', function() {
      const Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasMany(Comment, {foreignKey: 'post_id'});
      Comment.belongsTo(Post, {foreignKey: 'post_id'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          Post.create(),
          Comment.create()
        ).spread((post, comment) => {
          expect(comment.get('post_id')).not.to.be.ok;

          const setter = comment.setPost(post, {save: false});

          expect(setter).to.be.undefined;
          expect(comment.get('post_id')).to.equal(post.get('id'));
          expect(comment.changed('post_id')).to.be.true;
        });
      });
    });

    it('supports setting same association twice', function() {
      const Home = this.sequelize.define('home', {}),
        User = this.sequelize.define('user');

      Home.belongsTo(User);

      return this.sequelize.sync({ force: true }).bind({}).then(() => {
        return Promise.all([
          Home.create(),
          User.create()
        ]);
      }).spread(function(home, user) {
        this.home = home;
        this.user = user;
        return home.setUser(user);
      }).then(function() {
        return this.home.setUser(this.user);
      }).then(function() {
        return expect(this.home.getUser()).to.eventually.have.property('id', this.user.get('id'));
      });
    });
  });

  describe('createAssociation', () => {
    it('creates an associated model instance', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.belongsTo(User);

      return this.sequelize.sync({ force: true }).then(() => {
        return Task.create({ title: 'task' }).then(task => {
          return task.createUser({ username: 'bob' }).then(() => {
            return task.getUser().then(user => {
              expect(user).not.to.be.null;
              expect(user.username).to.equal('bob');
            });
          });
        });
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
            Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

          Group.belongsTo(User);

          return sequelize.sync({ force: true }).then(() => {
            return Group.create({ name: 'bar' }).then(group => {
              return sequelize.transaction().then(t => {
                return group.createUser({ username: 'foo' }, { transaction: t }).then(() => {
                  return group.getUser().then(user => {
                    expect(user).to.be.null;

                    return group.getUser({ transaction: t }).then(user => {
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

  describe('foreign key', () => {
    it('should lowercase foreign keys when using underscored', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true }),
        Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true });

      User.belongsTo(Account);

      expect(User.rawAttributes.account_id).to.exist;
    });

    it('should use model name when using camelcase', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false }),
        Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false });

      User.belongsTo(Account);

      expect(User.rawAttributes.AccountId).to.exist;
    });

    it('should support specifying the field of a foreign key', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false }),
        Account = this.sequelize.define('Account', { title: Sequelize.STRING }, { underscored: false });

      User.belongsTo(Account, {
        foreignKey: {
          name: 'AccountId',
          field: 'account_id'
        }
      });

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('account_id');

      return Account.sync({ force: true }).then(() => {
        // Can't use Promise.all cause of foreign key references
        return User.sync({ force: true });
      }).then(() => {
        return Promise.all([
          User.create({ username: 'foo' }),
          Account.create({ title: 'pepsico' })
        ]);
      }).spread((user, account) => {
        return user.setAccount(account).then(() => {
          return user.getAccount();
        });
      }).then(user => {
        // the sql query should correctly look at task_id instead of taskId
        expect(user).to.not.be.null;
        return User.findOne({
          where: {username: 'foo'},
          include: [Account]
        });
      }).then(task => {
        expect(task.Account).to.exist;
      });
    });
  });

  describe('foreign key constraints', () => {
    it('are enabled by default', function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User); // defaults to SET NULL

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'foo' }).then(user => {
          return Task.create({ title: 'task' }).then(task => {
            return task.setUser(user).then(() => {
              return user.destroy().then(() => {
                return task.reload().then(() => {
                  expect(task.UserId).to.equal(null);
                });
              });
            });
          });
        });
      });
    });

    it('sets to NO ACTION if allowNull: false', function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: { allowNull: false }}); // defaults to NO ACTION

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'foo' }).then(user => {
          return Task.create({ title: 'task', UserId: user.id }).then(() => {
            return expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(() => {
              return Task.findAll().then(tasks => {
                expect(tasks).to.have.length(1);
              });
            });
          });
        });
      });
    });

    it('should be possible to disable them', function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      Task.belongsTo(User, { constraints: false });

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'foo' }).then(user => {
          return Task.create({ title: 'task' }).then(task => {
            return task.setUser(user).then(() => {
              return user.destroy().then(() => {
                return task.reload().then(() => {
                  expect(task.UserId).to.equal(user.id);
                });
              });
            });
          });
        });
      });
    });

    it('can cascade deletes', function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, {onDelete: 'cascade'});

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'foo' }).then(user => {
          return Task.create({ title: 'task' }).then(task => {
            return task.setUser(user).then(() => {
              return user.destroy().then(() => {
                return Task.findAll().then(tasks => {
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
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onDelete: 'restrict'});

        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({ username: 'foo' }).then(user => {
            return Task.create({ title: 'task' }).then(task => {
              return task.setUser(user).then(() => {
                return expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(() => {
                  return Task.findAll().then(tasks => {
                    expect(tasks).to.have.length(1);
                  });
                });
              });
            });
          });
        });
      });

      it('can restrict updates', function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onUpdate: 'restrict'});

        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({ username: 'foo' }).then(user => {
            return Task.create({ title: 'task' }).then(task => {
              return task.setUser(user).then(() => {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                const tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.constructor);
                return expect(
                  user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id})
                ).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError).then(() => {
                  // Should fail due to FK restriction
                  return Task.findAll().then(tasks => {
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
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, {onUpdate: 'cascade'});

        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({ username: 'foo' }).then(user => {
            return Task.create({ title: 'task' }).then(task => {
              return task.setUser(user).then(() => {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                const tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.constructor);
                return user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id})
                  .then(() => {
                    return Task.findAll().then(tasks => {
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

  describe('Association column', () => {
    it('has correct type and name for non-id primary keys with non-integer type', function() {
      const User = this.sequelize.define('UserPKBT', {
          username: {
            type: DataTypes.STRING
          }
        }),
        self = this;

      const Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      });

      User.belongsTo(Group);

      return self.sequelize.sync({ force: true }).then(() => {
        expect(User.rawAttributes.GroupPKBTName.type).to.an.instanceof(DataTypes.STRING);
      });
    });

    it('should support a non-primary key as the association column on a target without a primary key', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username'});

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'bob' }).then(newUser => {
          return Task.create({ title: 'some task' }).then(newTask => {
            return newTask.setUser(newUser).then(() => {
              return Task.findOne({ where: { title: 'some task' } }).then(foundTask => {
                return foundTask.getUser().then(foundUser => {
                  expect(foundUser.username).to.equal('bob');
                });
              });
            });
          });
        });
      });
    });

    it('should support a non-primary unique key as the association column', function() {
      const User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            field: 'user_name',
            unique: true
          }
        }),
        Task = this.sequelize.define('Task', {
          title: DataTypes.STRING
        });

      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username'});

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'bob' }).then(newUser => {
          return Task.create({ title: 'some task' }).then(newTask => {
            return newTask.setUser(newUser).then(() => {
              return Task.findOne({ where: { title: 'some task' } }).then(foundTask => {
                return foundTask.getUser().then(foundUser => {
                  expect(foundUser.username).to.equal('bob');
                });
              });
            });
          });
        });
      });
    });

    it('should support a non-primary key as the association column with a field option', function() {
      const User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            field: 'the_user_name_field'
          }
        }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username'});

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'bob' }).then(newUser => {
          return Task.create({ title: 'some task' }).then(newTask => {
            return newTask.setUser(newUser).then(() => {
              return Task.findOne({ where: { title: 'some task'} }).then(foundTask => {
                return foundTask.getUser().then(foundUser => {
                  expect(foundUser.username).to.equal('bob');
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Association options', () => {
    it('can specify data type for autogenerated relational keys', function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        dataTypes = [DataTypes.INTEGER, DataTypes.BIGINT, DataTypes.STRING],
        self = this,
        Tasks = {};

      dataTypes.forEach(dataType => {
        const tableName = 'TaskXYZ_' + dataType.key;
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING });

        Tasks[dataType].belongsTo(User, { foreignKey: 'userId', keyType: dataType, constraints: false });
      });

      return self.sequelize.sync({ force: true }).then(() => {
        dataTypes.forEach(dataType => {
          expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
        });
      });
    });

    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works with a column that hasnt been defined before', function() {
        const Task = this.sequelize.define('task', {}),
          User = this.sequelize.define('user', {});

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
        const User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          }),
          Profile = this.sequelize.define('project', {
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
        const Task = this.sequelize.define('task', {
            projectId: {
              defaultValue: 42,
              type: Sequelize.INTEGER
            }
          }),
          Project = this.sequelize.define('project', {});

        Task.belongsTo(Project, { foreignKey: { allowNull: true }});

        expect(Task.rawAttributes.projectId).to.be.ok;
        expect(Task.rawAttributes.projectId.defaultValue).to.equal(42);
        expect(Task.rawAttributes.projectId.allowNull).to.be.ok;
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      const Person = this.sequelize.define('person', {}),
        Car = this.sequelize.define('car', {});

      expect(Car.belongsTo.bind(Car, Person, {foreignKey: 'person'})).to
        .throw ('Naming collision between attribute \'person\' and association \'person\' on model car. To remedy this, change either foreignKey or as in your association definition');
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
      const Person = this.sequelize.define('person', {}),
        Car = this.sequelize.define('car', {
          person: Sequelize.INTEGER
        });

      expect(Car.belongsTo.bind(Car, Person, {as: 'person'})).to
        .throw ('Naming collision between attribute \'person\' and association \'person\' on model car. To remedy this, change either foreignKey or as in your association definition');
    });
  });
});

describe('Association', () => {
  it('should set foreignKey on foreign table', function() {
    const Mail = this.sequelize.define('mail', {}, { timestamps: false });
    const Entry = this.sequelize.define('entry', {}, { timestamps: false });
    const User = this.sequelize.define('user', {}, { timestamps: false });
    Entry.belongsTo(User, { as: 'owner', foreignKey: { name: 'ownerId', allowNull: false } });
    Entry.belongsTo(Mail, {
      as: 'mail',
      foreignKey: {
        name: 'mailId',
        allowNull: false
      }
    });
    Mail.belongsToMany(User, {
      as: 'recipients',
      through: 'MailRecipients',
      otherKey: {
        name: 'recipientId',
        allowNull: false
      },
      foreignKey: {
        name: 'mailId',
        allowNull: false
      },
      timestamps: false
    });
    Mail.hasMany(Entry, {
      as: 'entries',
      foreignKey: {
        name: 'mailId',
        allowNull: false
      }
    });
    User.hasMany(Entry, {
      as: 'entries',
      foreignKey: {
        name: 'ownerId',
        allowNull: false
      }
    });
    return this.sequelize.sync({ force: true })
      .then(() => User.create({}))
      .then(() => Mail.create({}))
      .then(mail =>
        Entry.create({ mailId: mail.id, ownerId: 1 })
          .then(() => Entry.create({ mailId: mail.id, ownerId: 1 }))
          // set recipients
          .then(() => mail.setRecipients([1]))
      )
      .then(() => Entry.findAndCount({
        offset: 0,
        limit: 10,
        order: [['id', 'DESC']],
        include: [
          {
            association: Entry.associations.mail,
            include: [
              {
                association: Mail.associations.recipients,
                through: {
                  where: {
                    recipientId: 1
                  }
                },
                required: true
              }
            ],
            required: true
          }
        ]
      })).then(result => {
        expect(result.count).to.equal(2);
        expect(result.rows[0].get({ plain: true })).to.deep.equal(
          {
            id: 2,
            ownerId: 1,
            mailId: 1,
            mail: {
              id: 1,
              recipients: [{
                id: 1,
                MailRecipients: {
                  mailId: 1,
                  recipientId: 1
                }
              }]
            }
          }
        );
      });
  });
});
