'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , Sequelize = Support.Sequelize
  , sinon = require('sinon')
  , dialect   = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Hooks'), function() {
  describe('#validate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          beforeEach(function() {
            this.User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeValidate: function(user, options, fn) {
                  user.mood = 'happy';
                  fn();
                },
                afterValidate: function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                }
              }
            });

            return this.User.sync({ force: true });
          });

          describe('#bulkCreate', function() {
            describe('with no specific DAO hooks', function() {
              it('should return without a defined callback', function() {
                var self = this
                  , beforeBulkCreate = false
                  , afterBulkCreate = false;

                this.User.beforeBulkCreate(function(daos, options, fn) {
                  beforeBulkCreate = true;
                  daos.map(function(d) {
                    d.mood = 'happy';
                  });

                  fn();
                });

                this.User.afterBulkCreate(function(daos, fields, fn) {
                  afterBulkCreate = true;

                  fn();
                });

                return this.User.bulkCreate([
                  {username: 'Bob', mood: 'cold'},
                  {username: 'Tobi', mood: 'hot'}
                ]).then(function() {
                  return self.User.findAll().then(function(users) {
                    expect(beforeBulkCreate).to.be.true;
                    expect(afterBulkCreate).to.be.true;
                    expect(users[0].mood).to.equal('happy');
                    expect(users[0].mood).to.equal('happy');
                  });
                });
              });
            });

            describe('with specific DAO hooks', function() {
              it('should return without a defined callback', function() {
                var self = this
                  , beforeBulkCreate = false
                  , afterBulkCreate = false;

                this.User.beforeBulkCreate(function(daos, options, fn) {
                  beforeBulkCreate = true;
                  daos.map(function(d) {
                    d.mood = 'happy';
                  });

                  fn();
                });

                this.User.afterBulkCreate(function(daos, fields, fn) {
                  afterBulkCreate = true;

                  fn();
                });

                return this.User.bulkCreate([
                  {username: 'Bob', mood: 'cold'},
                  {username: 'Tobi', mood: 'hot'}
                ], { individualHooks: true }).then(function(bulkUsers) {
                  expect(beforeBulkCreate).to.be.true;
                  expect(afterBulkCreate).to.be.true;
                  expect(bulkUsers).to.be.instanceof(Array);
                  expect(bulkUsers).to.have.length(2);
                  return self.User.findAll().then(function(users) {
                    expect(users[0].mood).to.equal('happy');
                    expect(users[1].mood).to.equal('happy');
                  });
                });
              });
            });
          });

          it('#create', function() {
            return this.User.create({mood: 'ecstatic'}).then(function(user) {
              expect(user.mood).to.equal('happy');
              expect(user.username).to.equal('Toni');
            });
          });

          it('#save', function() {
            return this.User.create({mood: 'sad'}).then(function(user) {
              user.mood = 'ecstatic';
              return user.save().then(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
              });
            });
          });

          it('#updateAttributes / update', function() {
            return this.User.create({mood: 'sad'}).then(function(user) {
              return user.updateAttributes({mood: 'ecstatic'}).then(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
              });
            });
          });

          it('#update / bulkUpdate', function() {
            var self = this
              , beforeBulkUpdate = false
              , afterBulkUpdate = false;

            this.User.beforeBulkUpdate(function(options, fn) {
              beforeBulkUpdate = true;

              fn();
            });

            this.User.afterBulkUpdate(function(options, fn) {
              afterBulkUpdate = true;

              fn();
            });

            return this.User.create({mood: 'sad'}).then(function() {
              return self.User.update({mood: 'ecstatic'}, {where: {username: 'Toni'}, validate: true}).then(function() {
                return self.User.find({where: {username: 'Toni'}}).then(function(user) {
                  expect(beforeBulkUpdate).to.be.true;
                  expect(afterBulkUpdate).to.be.true;
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          beforeEach(function() {
            this.User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeValidate: [
                  function(user, options, fn) {
                    user.mood = 'joyful';
                    fn();
                  },
                  function(user, options, fn) {
                    user.mood = 'happy';
                    fn();
                  }
                ],
                afterValidate: [
                  function(user, options, fn) {
                    user.username = 'Tobi';
                    fn();
                  },
                  function(user, options, fn) {
                    user.username = 'Toni';
                    fn();
                  }
                ]
              }
            });

            return this.User.sync({ force: true });
          });

          describe('#create', function() {
            it('should return the user with a defined callback', function() {
              return this.User.create({mood: 'ecstatic'}).then(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          beforeEach(function() {
            this.User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeValidate: function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                },
                afterValidate: function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                }
              }
            });

            return this.User.sync({ force: true });
          });

          describe('#create', function() {
            it('should return an error based on the hook', function() {
              return this.User.create({mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          beforeEach(function() {
            this.User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeValidate: [
                  function(user, options, fn) {
                    user.mood = 'happy';
                    fn();
                  },
                  function(user, options, fn) {
                    user.mood = 'ecstatic';
                    fn();
                  }
                ],
                afterValidate: [
                  function(user, options, fn) {
                    user.username = 'Tobi';
                    fn();
                  },
                  function(user, options, fn) {
                    user.username = 'Toni';
                    fn();
                  }
                ]
              }
            });

            return this.User.sync({ force: true });
          });

          describe('#create', function() {
            it('should return an error based on the hook', function() {
              return this.User.create({mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({ force: true });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            beforeEach(function() {
              this.User.beforeValidate(function(user, options, fn) {
                user.mood = 'happy';
                fn();
              });

              this.User.afterValidate(function(user, options, fn) {
                user.username = 'Toni';
                fn();
              });
            });

            describe('#create', function() {
              it('should return the user', function() {
                return this.User.create({mood: 'ecstatic'}).then(function(user) {
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                });
              });
            });
          });

          describe('on error', function() {
            describe('should run hooks', function() {
              beforeEach(function() {
                this.User.beforeValidate(function(user, options, fn) {
                  user.username = 'Toni';
                  user.mood = 'ecstatic';
                  fn();
                });
              });

              describe('#create', function() {
                it('should return the error without the user within callback', function() {
                  return this.User.create({mood: 'happy'}).catch(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                  });
                });
              });
            });

            describe('should emit an error from after hook', function() {
              beforeEach(function() {
                this.User.afterValidate(function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn(new Error('Whoops! Changed user.mood!'));
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'happy'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('should run hooks', function() {
              beforeEach(function() {
                this.User.beforeValidate(function(user, options, fn) {
                  user.mood = 'joyful';
                  fn();
                });

                this.User.beforeValidate(function(user, options, fn) {
                  if (user.mood === 'joyful') {
                    user.mood = 'happy';
                  }
                  fn();
                });

                this.User.afterValidate(function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'ecstatic'}).then(function(user) {
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                });
              });
            });
          });

          describe('on error', function() {
            describe('should run hooks', function() {
              beforeEach(function() {
                this.User.beforeValidate(function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                });

                this.User.beforeValidate(function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'happy'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                });
              });
            });

            describe('should emit an error from after hook', function() {
              beforeEach(function() {
                this.User.afterValidate(function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });

                this.User.afterValidate(function(user, options, fn) {
                  fn(new Error('Whoops! Changed user.mood!'));
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'happy'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('success', function() {
            it('should run hooks on #create', function() {
              this.User.hook('beforeValidate', function(user, options, fn) {
                user.mood = 'happy';
                fn();
              });

              this.User.hook('afterValidate', function(user, options, fn) {
                user.username = 'Toni';
                fn();
              });

              return this.User.create({mood: 'ecstatic'}).then(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
              });
            });
          });

          describe('error', function() {
            it('should emit an error from before hook', function() {
              this.User.hook('beforeValidate', function(user, options, fn) {
                user.username = 'Toni';
                user.mood = 'ecstatic';
                fn();
              });

              return this.User.create({mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
              });
            });

            it('should emit an error from after hook', function() {
              this.User.hook('afterValidate', function(user, options, fn) {
                user.mood = 'ecstatic';
                fn(new Error('Whoops! Changed user.mood!'));
              });

              return this.User.create({mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });

        describe('multiple hooks', function() {
          describe('on success', function() {
            describe('should run hooks', function() {
              beforeEach(function() {
                this.User.hook('beforeValidate', function(user, options, fn) {
                  user.mood = 'joyful';
                  fn();
                });

                this.User.hook('beforeValidate', function(user, options, fn) {
                  if (user.mood === 'joyful') {
                    user.mood = 'happy';
                  }
                  fn();
                });

                this.User.hook('afterValidate', function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'ecstatic'}).then(function(user) {
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                });
              });
            });
          });

          describe('on error', function() {
            describe('should emit an error from before hook', function() {
              beforeEach(function() {
                this.User.hook('beforeValidate', function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                });

                this.User.hook('beforeValidate', function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'happy'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                });
              });
            });

            describe('should emit an error from after hook', function() {
              beforeEach(function() {
                this.User.hook('afterValidate', function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });

                this.User.hook('afterValidate', function(user, options, fn) {
                  fn(new Error('Whoops! Changed user.mood!'));
                });
              });

              it('#create', function() {
                return this.User.create({mood: 'happy'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });
      });
    });
  });

  describe('#create', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, options, fn) {
                  beforeHook = true;
                  attributes.mood = 'happy';
                  fn();
                },
                afterCreate: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                expect(user.mood).to.equal('happy');
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, options, fn) {
                    beforeHook = true;
                    attributes.mood = 'joyful';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    attributes.mood = 'happy';
                    fn();
                  }
                ],
                afterCreate: [
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                expect(user.mood).to.equal('happy');
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, options, fn) {
                  beforeHook = true;
                  fn(new Error('Whoops!'));
                },
                afterCreate: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
              });
            });
          });

          it('from after', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterCreate: function(attributes, options, fn) {
                  afterHook = true;
                  fn(new Error('Whoops!'));
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('from before', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, options, fn) {
                    beforeHook = 'fake';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn(new Error('Whoops!'));
                  }
                ],
                afterCreate: [
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
              });
            });
          });

          it('from after', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterCreate: [
                  function(attributes, options, fn) {
                    afterHook = 'fake';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn(new Error('Whoops!'));
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({force: true});
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = true;
                fn(null);
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeCreate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.afterCreate(function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeCreate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.hook('afterCreate', function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });
    });

    it('should not trigger hooks on parent when using N:M association setters', function() {
      var A = this.sequelize.define('A', {
        name: Sequelize.STRING
      });
      var B = this.sequelize.define('B', {
        name: Sequelize.STRING
      });

      var hookCalled = 0;

      A.addHook('afterCreate', function(instance, options, next) {
        hookCalled++;
        next();
      });

      B.belongsToMany(A, {through: 'a_b'});
      A.belongsToMany(B, {through: 'a_b'});

      return this.sequelize.sync({force: true}).bind(this).then(function() {
        return this.sequelize.Promise.all([
          A.create({name: 'a'}),
          B.create({name: 'b'})
        ]).spread(function(a, b) {
          return a.addB(b).then(function() {
            expect(hookCalled).to.equal(1);
          });
        });
      });
    });
  });

  describe('#updateAttributes', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, options, fn) {
                  beforeHook = true;
                  attributes.mood = 'happy';
                  options.fields.push('mood');
                  fn();
                },
                afterUpdate: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).then(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  expect(user.mood).to.equal('happy');
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, options, fn) {
                    beforeHook = true;
                    attributes.mood = 'joyful';
                    options.fields.push('mood');
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    attributes.mood = 'happy';
                    fn();
                  }
                ],
                afterUpdate: [
                  function(attributes, options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).then(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  expect(user.mood).to.equal('happy');
                });
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, options, fn) {
                  beforeHook = true;
                  fn(new Error('Whoops!'));
                },
                afterUpdate: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });
          });

          it('from after', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterUpdate: function(attributes, options, fn) {
                  afterHook = true;
                  fn(new Error('Whoops!'));
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('from before', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, options, fn) {
                    beforeHook = 'fake';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn(new Error('Whoops!'));
                  }
                ],
                afterUpdate: [
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });
          });

          it('from after', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterUpdate: [
                  function(attributes, options, fn) {
                    afterHook = 'fake';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn(new Error('Whoops!'));
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({force: true});
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).then(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).then(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = 'hi';
                fn(null, user);
              });

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'), user);
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = true;
                fn(null, user);
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeUpdate(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.afterUpdate(function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).then(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).then(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeUpdate', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.hook('afterUpdate', function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.updateAttributes({username: 'Chong'}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });
    });
  });

  describe('#destroy', function() {
    describe('via deifne', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterDestroy: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.destroy().then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, options, fn) {
                    beforeHook = true;
                    attributes.mood = 'joyful';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    attributes.mood = 'happy';
                    fn();
                  }
                ],
                afterDestroy: [
                  function(attributes, options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.destroy().then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, options, fn) {
                  beforeHook = true;
                  fn(new Error('Whoops!'));
                },
                afterDestroy: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });
          });

          it('from after', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterDestroy: function(attributes, options, fn) {
                  afterHook = true;
                  fn(new Error('Whoops!'));
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('from before', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, options, fn) {
                    beforeHook = 'fake';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn(new Error('Whoops!'));
                  }
                ],
                afterDestroy: [
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });
          });

          it('from after', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterDestroy: [
                  function(attributes, options, fn) {
                    afterHook = 'fake';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn(new Error('Whoops!'));
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.create({username: 'Cheech', mood: 'sad'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({force: true});
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.beforeDestroy(function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.afterDestroy(function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterDestory', function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = 'hi';
                fn();
              });

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = true;
                fn(new Error('Whoops!'));
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = true;
                fn();
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                });
              });
            });

            it('should return an error from after', function() {
              var beforeHook = false
                , afterHook = false;

              this.User.hook('beforeDestroy', function(user, options, fn) {
                beforeHook = true;
                fn();
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = 'hi';
                fn();
              });

              this.User.hook('afterDestroy', function(user, options, fn) {
                afterHook = true;
                fn(new Error('Whoops!'));
              });

              return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
                return user.destroy().catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });
    });
  });

  describe('#bulkCreate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: function(attributes, options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterBulkCreate: function(attributes, options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: [
                  function(attributes, options, fn) {
                    beforeHook = 'hi';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterBulkCreate: [
                  function(attributes, options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: function(attributes, options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterBulkCreate: function(attributes, options, fn) {
                  afterHook = true;
                  fn(new Error('Whoops!'));
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: [
                  function(attributes, options, fn) {
                    beforeHook = 'hi';
                    fn();
                  },
                  function(attributes, options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterBulkCreate: [
                  function(attributes, options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(attributes, options, fn) {
                    afterHook = true;
                    fn(new Error('Whoops!'));
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({ force: true });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkCreate(function(daos, options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkCreate(function(daos, options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.beforeBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.afterBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkCreate(function(daos, options, fn) {
                beforeBulk = 'hi';
                fn();
              });

              this.User.beforeBulkCreate(function(daos, options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkCreate(function(daos, options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.beforeBulkCreate(function(daos, options, fn) {
                fn();
              });

              this.User.beforeBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.afterBulkCreate(function(daos, options, fn) {
                fn();
              });

              this.User.afterBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                beforeBulk = 'hi';
                fn();
              });

              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                fn();
              });

              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                fn();
              });

              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        return this.User.sync({ force: true });
      });

      it('should run the afterCreate/beforeCreate functions for each item created successfully', function() {
        var beforeBulkCreate = false
          , afterBulkCreate = false;

        this.User.beforeBulkCreate(function(daos, options, fn) {
          beforeBulkCreate = true;
          fn();
        });

        this.User.afterBulkCreate(function(daos, options, fn) {
          afterBulkCreate = true;
          fn();
        });

        this.User.beforeCreate(function(user, options, fn) {
          user.beforeHookTest = true;
          fn();
        });

        this.User.afterCreate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        return this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).then(function(records) {
          records.forEach(function(record) {
            expect(record.username).to.equal('User' + record.id);
            expect(record.beforeHookTest).to.be.true;
          });
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.true;
        });
      });

      it('should run the afterCreate/beforeCreate functions for each item created with an error', function() {
        var beforeBulkCreate = false
          , afterBulkCreate = false;

        this.User.beforeBulkCreate(function(daos, options, fn) {
          beforeBulkCreate = true;
          fn();
        });

        this.User.afterBulkCreate(function(daos, options, fn) {
          afterBulkCreate = true;
          fn();
        });

        this.User.beforeCreate(function(user, options, fn) {
          fn(new Error('You shall not pass!'));
        });

        this.User.afterCreate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        return this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).catch(function(err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.false;
        });
      });
    });
  });

  describe('#bulkUpdate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: function(options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterBulkUpdate: function(options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: [
                  function(options, fn) {
                    beforeHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterBulkUpdate: [
                  function(options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: function(options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterBulkUpdate: function(options, fn) {
                  afterHook = true;
                  fn(new Error('Whoops!'));
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: [
                  function(options, fn) {
                    beforeHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterBulkUpdate: [
                  function(options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    afterHook = true;
                    fn(new Error('Whoops!'));
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({ force: true });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkUpdate(function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkUpdate(function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var self = this;

              this.User.beforeBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });

            it('should return an error from after', function() {
              var self = this;

              this.User.afterBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkUpdate(function(options, fn) {
                beforeBulk = 'hi';
                fn();
              });

              this.User.beforeBulkUpdate(function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkUpdate(function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var self = this;

              this.User.beforeBulkUpdate(function(options, fn) {
                fn();
              });

              this.User.beforeBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });

            it('should return an error from after', function() {
              var self = this;

              this.User.afterBulkUpdate(function(options, fn) {
                fn();
              });

              this.User.afterBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkUpdate', function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var self = this;

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });

            it('should return an error from after', function() {
              var self = this;

              this.User.hook('afterBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                beforeBulk = 'hi';
                fn();
              });

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkUpdate', function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).then(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              var self = this;

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                fn();
              });

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });

            it('should return an error from after', function() {
              var self = this;

              this.User.hook('afterBulkUpdate', function(options, fn) {
                fn();
              });

              this.User.hook('afterBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).then(function() {
                return self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                });
              });
            });
          });
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        return this.User.sync({ force: true });
      });

      it('should run the after/before functions for each item created successfully', function() {
        var self = this
          , beforeBulk = false
          , afterBulk = false;

        this.User.beforeBulkUpdate(function(options, fn) {
          beforeBulk = true;
          fn();
        });

        this.User.afterBulkUpdate(function(options, fn) {
          afterBulk = true;
          fn();
        });

        this.User.beforeUpdate(function(user, options, fn) {
          expect(user.changed()).to.not.be.empty;
          user.beforeHookTest = true;
          fn();
        });

        this.User.afterUpdate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread(function(affectedRows, records) {
            records.forEach(function(record) {
              expect(record.username).to.equal('User' + record.id);
              expect(record.beforeHookTest).to.be.true;
            });
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
          });
        });
      });

      it('should run the after/before functions for each item created successfully changing some data before updating', function() {
        var self = this;

        this.User.beforeUpdate(function(user, options) {
          expect(user.changed()).to.not.be.empty;
          if (user.get('id') === 1) {
            user.set('aNumber', user.get('aNumber') + 3);
          }
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread(function(affectedRows, records) {
            records.forEach(function(record, i) {
              expect(record.aNumber).to.equal(10 + (record.id === 1 ? 3 : 0));
            });
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        var self = this
          , beforeBulk = false
          , afterBulk = false;

        this.User.beforeBulkUpdate(function(options) {
          beforeBulk = true;
        });

        this.User.afterBulkUpdate(function(options) {
          afterBulk = true;
        });

        this.User.beforeUpdate(function(user, options) {
          throw new Error('You shall not pass!');
        });

        this.User.afterUpdate(function(user, options) {
          user.username = 'User' + user.id;
        });

        return this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(function() {
          return self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).catch(function(err) {
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.be.equal('You shall not pass!');
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.false;
          });
        });
      });
    });
  });

  describe('#bulkDestroy', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: function(options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterBulkDestroy: function(options, fn) {
                  afterHook = true;
                  fn();
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: [
                  function(options, fn) {
                    beforeHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterBulkDestroy: [
                  function(options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    afterHook = true;
                    fn();
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should run hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: function(options, fn) {
                  beforeHook = true;
                  fn();
                },
                afterBulkDestroy: function(options, fn) {
                  afterHook = true;
                  fn(new Error('Whoops!'));
                }
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function() {
            var beforeHook = false
              , afterHook = false;

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: [
                  function(options, fn) {
                    beforeHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    beforeHook = true;
                    fn();
                  }
                ],
                afterBulkDestroy: [
                  function(options, fn) {
                    afterHook = 'hi';
                    fn();
                  },
                  function(options, fn) {
                    afterHook = true;
                    fn(new Error('Whoops!'));
                  }
                ]
              }
            });

            return User.sync({ force: true }).then(function() {
              return User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        return this.User.sync({ force: true });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkDestroy(function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkDestroy(function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.beforeBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.afterBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkDestroy(function(options, fn) {
                beforeBulk = 'hi';
                fn();
              });

              this.User.beforeBulkDestroy(function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkDestroy(function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.beforeBulkDestroy(function(options, fn) {
                fn();
              });

              this.User.beforeBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.afterBulkDestroy(function(options, fn) {
                fn();
              });

              this.User.afterBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkDestroy', function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkDestroy', function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.hook('beforeBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.hook('afterBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run hooks', function() {
              var beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkDestroy', function(options, fn) {
                beforeBulk = 'hi';
                fn();
              });

              this.User.hook('beforeBulkDestroy', function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkDestroy', function(options, fn) {
                afterBulk = true;
                fn();
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).then(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function() {
              this.User.hook('beforeBulkDestroy', function(options, fn) {
                fn();
              });

              this.User.hook('beforeBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });

            it('should return an error from after', function() {
              this.User.hook('afterBulkDestroy', function(options, fn) {
                fn();
              });

              this.User.hook('afterBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              return this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        return this.User.sync({ force: true });
      });

      it('should run the after/before functions for each item created successfully', function() {
        var self = this
          , beforeBulk = false
          , afterBulk = false
          , beforeHook = false
          , afterHook = false;

        this.User.beforeBulkDestroy(function(options, fn) {
          beforeBulk = true;
          fn();
        });

        this.User.afterBulkDestroy(function(options, fn) {
          afterBulk = true;
          fn();
        });

        this.User.beforeDestroy(function(user, options, fn) {
          beforeHook = true;
          fn();
        });

        this.User.afterDestroy(function(user, options, fn) {
          afterHook = true;
          fn();
        });

        return this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).then(function() {
          return self.User.destroy({where: {aNumber: 1}, individualHooks: true}).then(function() {
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterHook).to.be.true;
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function() {
        var self = this
          , beforeBulk = false
          , afterBulk = false
          , beforeHook = false
          , afterHook = false;

        this.User.beforeBulkDestroy(function(options, fn) {
          beforeBulk = true;
          fn();
        });

        this.User.afterBulkDestroy(function(options, fn) {
          afterBulk = true;
          fn();
        });

        this.User.beforeDestroy(function(user, options, fn) {
          beforeHook = true;
          fn(new Error('You shall not pass!'));
        });

        this.User.afterDestroy(function(user, options, fn) {
          afterHook = true;
          fn();
        });

        return this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).then(function() {
          return self.User.destroy({where: {aNumber: 1}, individualHooks: true}).catch(function(err) {
            expect(err).to.be.instanceOf(Error);
            expect(beforeBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterBulk).to.be.false;
            expect(afterHook).to.be.false;
          });
        });
      });
    });
  });

  describe('#find', function() {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        mood: {
          type: DataTypes.ENUM,
          values: ['happy', 'sad', 'neutral']
        }
      });

      return this.User.sync({ force: true }).bind(this).then(function() {
        return this.User.bulkCreate([
          {username: 'adam', mood: 'happy'},
          {username: 'joe', mood: 'sad'}
        ]);
      });
    });

    describe('on success', function() {
      it('all hooks run', function() {
        var beforeHook = false
          , beforeHook2 = false
          , beforeHook3 = false
          , afterHook = false;

        this.User.beforeFind(function() {
          beforeHook = true;
        });

        this.User.beforeFindAfterExpandIncludeAll(function() {
          beforeHook2 = true;
        });

        this.User.beforeFindAfterOptions(function() {
          beforeHook3 = true;
        });

        this.User.afterFind(function() {
          afterHook = true;
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(beforeHook).to.be.true;
          expect(beforeHook2).to.be.true;
          expect(beforeHook3).to.be.true;
          expect(afterHook).to.be.true;
        });
      });

      it('beforeFind hook can change options', function() {
        this.User.beforeFind(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterExpandIncludeAll hook can change options', function() {
        this.User.beforeFindAfterExpandIncludeAll(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('beforeFindAfterOptions hook can change options', function() {
        this.User.beforeFindAfterOptions(function(options) {
          options.where.username = 'joe';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });

      it('afterFind hook can change results', function() {
        this.User.afterFind(function(user) {
          user.mood = 'sad';
        });

        return this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
        });
      });
    });

    describe('on error', function() {
      it('in beforeFind hook returns error', function() {
        this.User.beforeFind(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterExpandIncludeAll hook returns error', function() {
        this.User.beforeFindAfterExpandIncludeAll(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in beforeFindAfterOptions hook returns error', function() {
        this.User.beforeFindAfterOptions(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });

      it('in afterFind hook returns error', function() {
        this.User.afterFind(function() {
          throw new Error('Oops!');
        });

        return this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
        });
      });
    });
  });

  describe('#define', function() {
    before(function() {
      this.sequelize.addHook('beforeDefine', function(attributes, options) {
        options.modelName = 'bar';
        options.name.plural = 'barrs';
        attributes.type = DataTypes.STRING;
      });

      this.sequelize.addHook('afterDefine', function(factory) {
        factory.options.name.singular = 'barr';
      });

      this.model = this.sequelize.define('foo', {name: DataTypes.STRING});
    });

    it('beforeDefine hook can change model name', function() {
      expect(this.model.name).to.equal('bar');
    });

    it('beforeDefine hook can alter options', function() {
      expect(this.model.options.name.plural).to.equal('barrs');
    });

    it('beforeDefine hook can alter attributes', function() {
      expect(this.model.rawAttributes.type).to.be.ok;
    });

    it('afterDefine hook can alter options', function() {
      expect(this.model.options.name.singular).to.equal('barr');
    });

    after(function() {
      this.sequelize.options.hooks = {};
      this.sequelize.modelManager.removeDAO(this.model);
    });
  });

  describe('#init', function() {
    before(function() {
      Sequelize.addHook('beforeInit', function(config, options) {
        config.database = 'db2';
        options.host = 'server9';
      });

      Sequelize.addHook('afterInit', function(sequelize) {
        sequelize.options.protocol = 'udp';
      });

      this.seq = new Sequelize('db', 'user', 'pass', {});
    });

    it('beforeInit hook can alter config', function() {
      expect(this.seq.config.database).to.equal('db2');
    });

    it('beforeInit hook can alter options', function() {
      expect(this.seq.options.host).to.equal('server9');
    });

    it('afterInit hook can alter options', function() {
      expect(this.seq.options.protocol).to.equal('udp');
    });

    after(function() {
      Sequelize.options.hooks = {};
    });
  });

  describe('universal', function() {
    beforeEach(function() {
      this.sequelize.addHook('beforeFind', function(options) {
        options.where.name = 'Chong';
      });

      this.Person = this.sequelize.define('Person', {name: DataTypes.STRING});

      return this.Person.sync({ force: true }).bind(this).then(function() {
        return this.Person.create({name: 'Cheech'});
      }).then(function() {
        return this.Person.create({name: 'Chong'});
      });
    });

    it('hooks run on all models', function() {
      return this.Person.find({where: {name: 'Cheech'}}).then(function(person) {
        expect(person.name).to.equal('Chong');
      });
    });

    afterEach(function() {
      this.sequelize.options.hooks = {};
    });
  });

  describe('aliases', function() {
    describe('direct method', function() {
      describe('#delete', function() {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING
          });

          return this.User.sync({ force: true });
        });

        it('on success', function() {
          var beforeHook
            , afterHook;

          this.User.beforeDelete(function(user, options, fn) {
            beforeHook = true;
            fn();
          });

          this.User.afterDelete(function(user, options, fn) {
            afterHook = true;
            fn();
          });

          return this.User.create({username: 'Toni'}).then(function(user) {
            return user.destroy().then(function() {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
            });
          });
        });

        it('on error', function() {
          var beforeHook
            , afterHook;

          this.User.beforeDelete(function(user, options, fn) {
            beforeHook = true;
            fn();
          });

          this.User.afterDelete(function(user, options, fn) {
            afterHook = true;
            fn(new Error('Whoops!'));
          });

          return this.User.create({username: 'Toni'}).then(function(user) {
            return user.destroy().catch(function(err) {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
              expect(err).to.be.instanceOf(Error);
            });
          });
        });
      });
    });

    describe('.hook() method', function() {
      describe('#delete', function() {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING
          });

          return this.User.sync({ force: true });
        });

        it('on success', function() {
          var beforeHook
            , afterHook;

          this.User.hook('beforeDelete', function(user, options, fn) {
            beforeHook = true;
            fn();
          });

          this.User.hook('afterDelete', function(user, options, fn) {
            afterHook = true;
            fn();
          });

          return this.User.create({username: 'Toni'}).then(function(user) {
            return user.destroy().then(function() {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
            });
          });
        });

        it('on error', function() {
          var beforeHook
            , afterHook;

          this.User.hook('beforeDelete', function(user, options, fn) {
            beforeHook = true;
            fn();
          });

          this.User.hook('afterDelete', function(user, options, fn) {
            afterHook = true;
            fn(new Error('Whoops!'));
          });

          return this.User.create({username: 'Toni'}).then(function(user) {
            return user.destroy().catch(function(err) {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
              expect(err).to.be.instanceOf(Error);
            });
          });
        });
      });
    });
  });

  describe('associations', function() {
    describe('1:1', function() {
      describe('cascade onUpdate', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onUpdate: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          var self = this
            , beforeHook = false
            , afterHook = false;

          this.Tasks.beforeUpdate(function(task, options, fn) {
            beforeHook = true;
            fn();
          });

          this.Tasks.afterUpdate(function(task, options, fn) {
            afterHook = true;
            fn();
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).then(function() {
                return project.updateAttributes({id: 2}).then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        it('on error', function() {
          var self = this;

          this.Tasks.afterUpdate(function(task, options, fn) {
            fn(new Error('Whoops!'));
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('cascade onDelete', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn();
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.setTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false
              , VeryCustomError = function() {};

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new VeryCustomError('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.setTask(task).then(function() {
                  return expect(project.destroy()).to.eventually.be.rejectedWith(VeryCustomError).then(function () {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade update', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          var self = this
            , beforeHook = false
            , afterHook = false;

          this.Tasks.beforeUpdate(function(task, options, fn) {
            beforeHook = true;
            fn();
          });

          this.Tasks.afterUpdate(function(task, options, fn) {
            afterHook = true;
            fn();
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).then(function() {
                return project.updateAttributes({id: 2}).then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        it('on error', function() {
          var self = this;

          this.Tasks.afterUpdate(function(task, options, fn) {
            fn(new Error('Whoops!'));
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('no cascade delete', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn();
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    describe('1:M', function() {
      describe('cascade', function() {
        beforeEach(function() {
          var self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects, {hooks: true});

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn();
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().catch(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn();
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    describe('M:M', function() {
      describe('cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.belongsToMany(this.Tasks, {cascade: 'onDelete', through: 'projects_and_tasks', hooks: true});
          this.Tasks.belongsToMany(this.Projects, {cascade: 'onDelete', through: 'projects_and_tasks', hooks: true});

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn();
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    // Since Sequelize does not cascade M:M, these should be false
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.belongsToMany(this.Tasks, {hooks: true, through: 'project_tasks'});
          this.Tasks.belongsToMany(this.Projects, {hooks: true, through: 'project_tasks'});

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn();
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
              , beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.false;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    // NOTE: Reenable when FK constraints create table query is fixed when using hooks
    if (dialect !== 'mssql') {
      describe('multiple 1:M', function () {

        describe('cascade', function() {
          beforeEach(function() {
            this.Projects = this.sequelize.define('Project', {
              title: DataTypes.STRING
            });

            this.Tasks = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

            this.MiniTasks = this.sequelize.define('MiniTask', {
              mini_title: DataTypes.STRING
            });

            this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
            this.Projects.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.Tasks.belongsTo(this.Projects, {hooks: true});
            this.Tasks.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.MiniTasks.belongsTo(this.Projects, {hooks: true});
            this.MiniTasks.belongsTo(this.Tasks, {hooks: true});

            return this.sequelize.sync({force: true});
          });

          describe('#remove', function() {
            it('with no errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn();
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, minitask) {
                return project.addMiniTask(minitask);
              }).then(function(project) {
                return project.destroy();
              }).then(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });

            });

            it('with errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn(new Error('Whoops!'));
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, minitask) {
                return project.addMiniTask(minitask);
              }).then(function(project) {
                return project.destroy();
              }).catch(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.false;
              });
            });
          });
        });
      });

      describe('multiple 1:M sequential hooks', function () {
        describe('cascade', function() {
          beforeEach(function() {
            this.Projects = this.sequelize.define('Project', {
              title: DataTypes.STRING
            });

            this.Tasks = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

            this.MiniTasks = this.sequelize.define('MiniTask', {
              mini_title: DataTypes.STRING
            });

            this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
            this.Projects.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.Tasks.belongsTo(this.Projects, {hooks: true});
            this.Tasks.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.MiniTasks.belongsTo(this.Projects, {hooks: true});
            this.MiniTasks.belongsTo(this.Tasks, {hooks: true});

            return this.sequelize.sync({force: true});
          });

          describe('#remove', function() {
            it('with no errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn();
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.Tasks.create({title: 'New Task'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, task, minitask) {
                return this.sequelize.Promise.all([
                  task.addMiniTask(minitask),
                  project.addTask(task)
                ]).return(project);
              }).then(function(project) {
                return project.destroy();
              }).then(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.true;
                expect(afterTask).to.be.true;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });
            });

            it('with errors', function() {
              var beforeProject = false
                , afterProject = false
                , beforeTask = false
                , afterTask = false
                , beforeMiniTask = false
                , afterMiniTask = false
                , VeryCustomError = function() {};

              this.Projects.beforeCreate(function() {
                beforeProject = true;
              });

              this.Projects.afterCreate(function() {
                afterProject = true;
              });

              this.Tasks.beforeDestroy(function() {
                beforeTask = true;
                throw new VeryCustomError('Whoops!');
              });

              this.Tasks.afterDestroy(function() {
                afterTask = true;
              });

              this.MiniTasks.beforeDestroy(function() {
                beforeMiniTask = true;
              });

              this.MiniTasks.afterDestroy(function() {
                afterMiniTask = true;
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.Tasks.create({title: 'New Task'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, task, minitask) {
                return this.sequelize.Promise.all([
                  task.addMiniTask(minitask),
                  project.addTask(task)
                ]).return(project);
              }).then(function(project) {
                return expect(project.destroy()).to.eventually.be.rejectedWith(VeryCustomError).then(function () {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                  expect(beforeMiniTask).to.be.false;
                  expect(afterMiniTask).to.be.false;
                });
              });
            });
          });
        });
      });
    }

  });

  describe('passing DAO instances', function() {
    describe('beforeValidate / afterValidate', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeValidate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              beforeHooked = true;
              fn();
            },
            afterValidate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function() {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
          });
        });
      });
    });

    describe('beforeCreate / afterCreate', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeCreate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              beforeHooked = true;
              fn();
            },
            afterCreate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function() {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
          });
        });
      });
    });

    describe('beforeDestroy / afterDestroy', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeDestroy: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              beforeHooked = true;
              fn();
            },
            afterDestroy: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function(user) {
            return user.destroy().then(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });

    describe('beforeDelete / afterDelete', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeDelete: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              beforeHooked = true;
              fn();
            },
            afterDelete: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function(user) {
            return user.destroy().then(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });

    describe('beforeUpdate / afterUpdate', function() {
      it('should pass a DAO instance to the hook', function() {
        var beforeHooked = false;
        var afterHooked = false;
        var User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            beforeUpdate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              beforeHooked = true;
              fn();
            },
            afterUpdate: function(user, options, fn) {
              expect(user).to.be.instanceof(User.DAO);
              afterHooked = true;
              fn();
            }
          }
        });

        return User.sync({ force: true }).then(function() {
          return User.create({ username: 'bob' }).then(function(user) {
            return user.save({ username: 'bawb' }).then(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
            });
          });
        });
      });
    });
  });

  describe('promises', function() {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        mood: {
          type: DataTypes.ENUM,
          values: ['happy', 'sad', 'neutral']
        }
      });

      return this.User.sync({ force: true });
    });

    it('can return a promise', function() {
      var self = this
        , hookRun = false;

      this.User.beforeBulkCreate(function() {
        hookRun = true;
        return self.sequelize.Promise.resolve();
      });

      return this.User.bulkCreate([
        {username: 'Bob', mood: 'happy'},
        {username: 'Tobi', mood: 'sad'}
      ], { individualHooks: false }).then(function() {
        return self.User.findAll().then(function() {
          expect(hookRun).to.equal(true);
        });
      });
    });

    it('can return undefined', function() {
      var self = this
        , hookRun = false;

      this.User.beforeBulkCreate(function() {
        hookRun = true;
      });

      return this.User.bulkCreate([
        {username: 'Bob', mood: 'happy'},
        {username: 'Tobi', mood: 'sad'}
      ], { individualHooks: false }).then(function() {
        return self.User.findAll().then(function() {
          expect(hookRun).to.equal(true);
        });
      });
    });

    it('can return an error by rejecting', function() {
      var self = this;

      this.User.beforeCreate(function() {
        return self.sequelize.Utils.Promise.reject(new Error('Forbidden'));
      });

      return this.User.create({}).catch (function(err) {
        expect(err.message).to.equal('Forbidden');
      });
    });

    it('can return an error by throwing', function() {
      this.User.beforeCreate(function() {
        throw (new Error('Forbidden'));
      });

      return this.User.create({}).catch (function(err) {
        expect(err.message).to.equal('Forbidden');
      });
    });
  });

  describe('#addHook', function() {
    it('should add additinoal hook when previous exists', function() {
      var hook1 = sinon.spy()
        , hook2 = sinon.spy()
        , Model;

      Model = this.sequelize.define('Model', {
        name: Sequelize.STRING
      }, {
        hooks: { beforeCreate: hook1 }
      });

      Model.addHook('beforeCreate', hook2);

      return Model.sync({ force: true }).then(function() {
        return Model.create({ name: 'bob' });
      }).then(function() {
        expect(hook1.calledOnce).to.be.ok;
        expect(hook2.calledOnce).to.be.ok;
      });
    });
  });
});
