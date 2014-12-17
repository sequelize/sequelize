'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../lib/data-types')
  , _ = require('lodash')
  , Sequelize = Support.Sequelize
  , sinon = require('sinon');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Hooks'), function() {
  describe('#validate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          beforeEach(function(done) {
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

            this.User.sync({ force: true }).success(function() {
              done();
            });
          });

          describe('#bulkCreate', function() {
            describe('with no specific DAO hooks', function() {
              it('should return without a defined callback', function(done) {
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

                this.User.bulkCreate([
                  {username: 'Bob', mood: 'cold'},
                  {username: 'Tobi', mood: 'hot'}
                ]).success(function() {
                  self.User.all().success(function(users) {
                    expect(beforeBulkCreate).to.be.true;
                    expect(afterBulkCreate).to.be.true;
                    expect(users[0].mood).to.equal('happy');
                    expect(users[0].mood).to.equal('happy');
                    done();
                  });
                });
              });
            });

            describe('with specific DAO hooks', function() {
              it('should return without a defined callback', function(done) {
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

                this.User.bulkCreate([
                  {username: 'Bob', mood: 'cold'},
                  {username: 'Tobi', mood: 'hot'}
                ], { individualHooks: true }).success(function(bulkUsers) {
                  expect(beforeBulkCreate).to.be.true;
                  expect(afterBulkCreate).to.be.true;
                  expect(bulkUsers).to.be.instanceof(Array);
                  expect(bulkUsers).to.have.length(2);

                  self.User.all().success(function(users) {
                    expect(users[0].mood).to.equal('happy');
                    expect(users[1].mood).to.equal('happy');
                    done();
                  });
                });
              });
            });
          });

          it('#create', function(done) {
            this.User.create({mood: 'ecstatic'}).success(function(user) {
              expect(user.mood).to.equal('happy');
              expect(user.username).to.equal('Toni');
              done();
            });
          });

          it('#save', function(done) {
            this.User.create({mood: 'sad'}).success(function(user) {
              user.mood = 'ecstatic';
              user.save().success(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
                done();
              });
            });
          });

          it('#updateAttributes / update', function(done) {
            this.User.create({mood: 'sad'}).success(function(user) {
              user.updateAttributes({mood: 'ecstatic'}).success(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
                done();
              });
            });
          });

          it('#update / bulkUpdate', function(done) {
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

            this.User.create({mood: 'sad'}).success(function() {
              self.User.update({mood: 'ecstatic'}, {where: {username: 'Toni'}, validate: true}).success(function() {
                self.User.find({where: {username: 'Toni'}}).success(function(user) {
                  expect(beforeBulkUpdate).to.be.true;
                  expect(afterBulkUpdate).to.be.true;
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          beforeEach(function(done) {
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

            this.User.sync({ force: true }).success(function() {
              done();
            });
          });

          describe('#create', function() {
            it('should return the user with a defined callback', function(done) {
              this.User.create({mood: 'ecstatic'}).success(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
                done();
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          beforeEach(function(done) {
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

            this.User.sync({ force: true }).success(function() {
              done();
            });
          });

          describe('#create', function() {
            it('should return an error based on the hook', function(done) {
              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          beforeEach(function(done) {
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

            this.User.sync({ force: true }).success(function() {
              done();
            });
          });

          describe('#create', function() {
            it('should return an error based on the hook', function(done) {
              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                done();
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            beforeEach(function(done) {
              this.User.beforeValidate(function(user, options, fn) {
                user.mood = 'happy';
                fn();
              });

              this.User.afterValidate(function(user, options, fn) {
                user.username = 'Toni';
                fn();
              });

              done();
            });

            describe('#create', function() {
              it('should return the user', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            describe('should run hooks', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, options, fn) {
                  user.username = 'Toni';
                  user.mood = 'ecstatic';
                  fn();
                });

                done();
              });

              describe('#create', function() {
                it('should return the error without the user within callback', function(done) {
                  this.User.create({mood: 'happy'}).error(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                    done();
                  });
                });
              });
            });

            describe('should emit an error from after hook', function() {
              beforeEach(function(done) {
                this.User.afterValidate(function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn(new Error('Whoops! Changed user.mood!'));
                });

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('should run hooks', function() {
              beforeEach(function(done) {
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

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            describe('should run hooks', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                });

                this.User.beforeValidate(function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                  done();
                });
              });
            });

            describe('should emit an error from after hook', function() {
              beforeEach(function(done) {
                this.User.afterValidate(function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });

                this.User.afterValidate(function(user, options, fn) {
                  fn(new Error('Whoops! Changed user.mood!'));
                });

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('success', function() {
            it('should run hooks on #create', function(done) {
              this.User.hook('beforeValidate', function(user, options, fn) {
                user.mood = 'happy';
                fn();
              });

              this.User.hook('afterValidate', function(user, options, fn) {
                user.username = 'Toni';
                fn();
              });

              this.User.create({mood: 'ecstatic'}).success(function(user) {
                expect(user.mood).to.equal('happy');
                expect(user.username).to.equal('Toni');
                done();
              });
            });
          });

          describe('error', function() {
            it('should emit an error from before hook', function(done) {
              this.User.hook('beforeValidate', function(user, options, fn) {
                user.username = 'Toni';
                user.mood = 'ecstatic';
                fn();
              });

              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                done();
              });
            });

            it('should emit an error from after hook', function(done) {
              this.User.hook('afterValidate', function(user, options, fn) {
                user.mood = 'ecstatic';
                fn(new Error('Whoops! Changed user.mood!'));
              });

              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });

        describe('multiple hooks', function() {
          describe('on success', function() {
            describe('should run hooks', function() {
              beforeEach(function(done) {
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

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy');
                  expect(user.username).to.equal('Toni');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            describe('should emit an error from before hook', function() {
              beforeEach(function(done) {
                this.User.hook('beforeValidate', function(user, options, fn) {
                  user.username = 'Toni';
                  fn();
                });

                this.User.hook('beforeValidate', function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(err.get('mood')[0].message).to.equal('Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral');
                  done();
                });
              });
            });

            describe('should emit an error from after hook', function() {
              beforeEach(function(done) {
                this.User.hook('afterValidate', function(user, options, fn) {
                  user.mood = 'ecstatic';
                  fn();
                });

                this.User.hook('afterValidate', function(user, options, fn) {
                  fn(new Error('Whoops! Changed user.mood!'));
                });

                done();
              });

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
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
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                expect(user.mood).to.equal('happy');
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                expect(user.mood).to.equal('happy');
                done();
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
                done();
              });
            });
          });

          it('from after', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('from before', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
                done();
              });
            });
          });

          it('from after', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({force: true}).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
                done();
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
                done();
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
                done();
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.false;
                done();
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });
    });

    it('should not trigger hooks on parent when using N:M association setters', function(done) {
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

      B.hasMany(A);
      A.hasMany(B);

      this.sequelize.sync({force: true}).done(function(err) {
        expect(err).not.to.be.ok;

        var chainer = new Sequelize.Utils.QueryChainer([
          A.create({name: 'a'}),
          B.create({name: 'b'})
        ]);

        chainer.run().done(function(err, res, a, b) {
          expect(err).not.to.be.ok;
          a.addB(b).done(function(err) {
            expect(err).not.to.be.ok;
            expect(hookCalled).to.equal(1);
            done();
          });
        });
      });
    });
  });

  describe('#updateAttributes', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  expect(user.mood).to.equal('happy');
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  expect(user.mood).to.equal('happy');
                  done();
                });
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });
          });

          it('from after', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('from before', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });
          });

          it('from after', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({force: true}).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  expect(user.username).to.equal('Chong');
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
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
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });
          });

          it('from after', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('from before', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });
          });

          it('from after', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({force: true}).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.false;
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
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

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
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
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkCreate(function(daos, options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkCreate(function(daos, options, fn) {
                afterBulk = true;
                fn();
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.afterBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
              var self = this
                , beforeBulk = false
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

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkCreate(function(daos, options, fn) {
                fn();
              });

              this.User.beforeBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.afterBulkCreate(function(daos, options, fn) {
                fn();
              });

              this.User.afterBulkCreate(function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                afterBulk = true;
                fn();
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
              var self = this
                , beforeBulk = false
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

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                fn();
              });

              this.User.hook('beforeBulkCreate', function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                fn();
              });

              this.User.hook('afterBulkCreate', function(daos, options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
      beforeEach(function(done) {
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

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      it('should run the afterCreate/beforeCreate functions for each item created successfully', function(done) {
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

        this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).success(function(records) {
          records.forEach(function(record) {
            expect(record.username).to.equal('User' + record.id);
            expect(record.beforeHookTest).to.be.true;
          });
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.true;
          done();
        });
      });

      it('should run the afterCreate/beforeCreate functions for each item created with an error', function(done) {
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

        this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], individualHooks: true }).error(function(err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.false;
          done();
        });
      });
    });
  });

  describe('#bulkUpdate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {where: {mood: 'sad'}}).success(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {where: {mood: 'sad'}}).success(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).success(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this;

              this.User.beforeBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
              var self = this;

              this.User.afterBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
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

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).success(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this;

              this.User.beforeBulkUpdate(function(options, fn) {
                fn();
              });

              this.User.beforeBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
              var self = this;

              this.User.afterBulkUpdate(function(options, fn) {
                fn();
              });

              this.User.afterBulkUpdate(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
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

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).success(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this;

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
              var self = this;

              this.User.hook('afterBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
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

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).success(function() {
                  expect(beforeBulk).to.be.true;
                  expect(afterBulk).to.be.true;
                  done();
                });
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this;

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                fn();
              });

              this.User.hook('beforeBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });

            it('should return an error from after', function(done) {
              var self = this;

              this.User.hook('afterBulkUpdate', function(options, fn) {
                fn();
              });

              this.User.hook('afterBulkUpdate', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {where: {mood: 'sad'}}).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
      beforeEach(function(done) {
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

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      it('should run the after/before functions for each item created successfully', function(done) {
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
          user.beforeHookTest = true;
          fn();
        });

        this.User.afterUpdate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).success(function() {
          self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).spread(function(affectedRows, records) {
            records.forEach(function(record) {
              expect(record.username).to.equal('User' + record.id);
              expect(record.beforeHookTest).to.be.true;
            });
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
            done();
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function(done) {
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
          fn(new Error('You shall not pass!'));
        });

        this.User.afterUpdate(function(user, options, fn) {
          user.username = 'User' + user.id;
          fn();
        });

        this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).success(function() {
          self.User.update({aNumber: 10}, {where: {aNumber: 1}, individualHooks: true}).error(function(err) {
            expect(err).to.be.instanceOf(Error);
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.false;
            done();
          });
        });
      });
    });
  });

  describe('#bulkDestroy', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.destroy({where: {username: 'Cheech', mood: 'sad'}}).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.destroy({where: {username: 'Cheech', mood: 'sad'}}).success(function() {
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should run hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          it('should run all hooks', function(done) {
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

            User.sync({ force: true }).success(function() {
              User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(beforeHook).to.be.true;
                expect(afterHook).to.be.true;
                done();
              });
            });
          });
        });
      });
    });

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        });

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.beforeBulkDestroy(function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.afterBulkDestroy(function(options, fn) {
                afterBulk = true;
                fn();
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.afterBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run all hooks', function(done) {
              var self = this
                , beforeBulk = false
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

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkDestroy(function(options, fn) {
                fn();
              });

              this.User.beforeBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.afterBulkDestroy(function(options, fn) {
                fn();
              });

              this.User.afterBulkDestroy(function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });
      });

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
              var self = this
                , beforeBulk = false
                , afterBulk = false;

              this.User.hook('beforeBulkDestroy', function(options, fn) {
                beforeBulk = true;
                fn();
              });

              this.User.hook('afterBulkDestroy', function(options, fn) {
                afterBulk = true;
                fn();
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should run hooks', function(done) {
              var self = this
                , beforeBulk = false
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

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).success(function() {
                expect(beforeBulk).to.be.true;
                expect(afterBulk).to.be.true;
                done();
              });
            });
          });

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkDestroy', function(options, fn) {
                fn();
              });

              this.User.hook('beforeBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkDestroy', function(options, fn) {
                fn();
              });

              this.User.hook('afterBulkDestroy', function(options, fn) {
                fn(new Error('Whoops!'));
              });

              this.User.destroy({where: {username: 'Cheech', mood: 'sad'}}).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });
      });
    });

    describe('with the {individualHooks: true} option', function() {
      beforeEach(function(done) {
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

        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      it('should run the after/before functions for each item created successfully', function(done) {
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


        this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).success(function() {
          self.User.destroy({where: {aNumber: 1}, individualHooks: true}).success(function() {
            expect(beforeBulk).to.be.true;
            expect(afterBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterHook).to.be.true;
            done();
          });
        });
      });

      it('should run the after/before functions for each item created with an error', function(done) {
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

        this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).success(function() {
          self.User.destroy({where: {aNumber: 1}, individualHooks: true}).error(function(err) {
            expect(err).to.be.instanceOf(Error);
            expect(beforeBulk).to.be.true;
            expect(beforeHook).to.be.true;
            expect(afterBulk).to.be.false;
            expect(afterHook).to.be.false;
            done();
          });
        });
      });
    });
  });

  describe('#find', function() {
    beforeEach(function(done) {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        mood: {
          type: DataTypes.ENUM,
          values: ['happy', 'sad', 'neutral']
        }
      });

      this.User.sync({ force: true }).bind(this).then(function() {
        return this.User.bulkCreate([
          {username: 'adam', mood: 'happy'},
          {username: 'joe', mood: 'sad'}
        ]);
      }).then(function() {
        done();
      });
    });

    describe('on success', function() {
      it('all hooks run', function(done) {
        var beforeHook = false
          , beforeHook2 = false
          , beforeHook3 = false
          , afterHook = false;

        this.User.beforeFind(function(options) {
          beforeHook = true;
        });

        this.User.beforeFindAfterExpandIncludeAll(function(options) {
          beforeHook2 = true;
        });

        this.User.beforeFindAfterOptions(function(options) {
          beforeHook3 = true;
        });

        this.User.afterFind(function(users, options) {
          afterHook = true;
        });

        this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(beforeHook).to.be.true;
          expect(beforeHook2).to.be.true;
          expect(beforeHook3).to.be.true;
          expect(afterHook).to.be.true;
          done();
        });
      });

      it('beforeFind hook can change options', function(done) {
        this.User.beforeFind(function(options) {
          options.where.username = 'joe';
        });

        this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
          done();
        });
      });

      it('beforeFindAfterExpandIncludeAll hook can change options', function(done) {
        this.User.beforeFindAfterExpandIncludeAll(function(options) {
          options.where.username = 'joe';
        });

        this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
          done();
        });
      });

      it('beforeFindAfterOptions hook can change options', function(done) {
        this.User.beforeFindAfterOptions(function(options) {
          options.where.username = 'joe';
        });

        this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
          done();
        });
      });

      it('afterFind hook can change results', function(done) {
        this.User.afterFind(function(user, options) {
          user.mood = 'sad';
        });

        this.User.find({where: {username: 'adam'}}).then(function(user) {
          expect(user.mood).to.equal('sad');
          done();
        });
      });
    });

    describe('on error', function() {
      it('in beforeFind hook returns error', function(done) {
        this.User.beforeFind(function(options) {
          throw new Error('Oops!');
        });

        this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
          done();
        });
      });

      it('in beforeFindAfterExpandIncludeAll hook returns error', function(done) {
        this.User.beforeFindAfterExpandIncludeAll(function(options) {
          throw new Error('Oops!');
        });

        this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
          done();
        });
      });

      it('in beforeFindAfterOptions hook returns error', function(done) {
        this.User.beforeFindAfterOptions(function(options) {
          throw new Error('Oops!');
        });

        this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
          done();
        });
      });

      it('in afterFind hook returns error', function(done) {
        this.User.afterFind(function(options) {
          throw new Error('Oops!');
        });

        this.User.find({where: {username: 'adam'}}).catch (function(err) {
          expect(err.message).to.equal('Oops!');
          done();
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
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING
          });

          this.User.sync({ force: true }).success(function() {
            done();
          });
        });

        it('on success', function(done) {
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

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().success(function() {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
              done();
            });
          });
        });

        it('on error', function(done) {
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

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().error(function(err) {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
              expect(err).to.be.instanceOf(Error);
              done();
            });
          });
        });
      });
    });

    describe('.hook() method', function() {
      describe('#delete', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING
          });

          this.User.sync({ force: true }).success(function() {
            done();
          });
        });

        it('on success', function(done) {
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

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().success(function() {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
              done();
            });
          });
        });

        it('on error', function(done) {
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

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().error(function(err) {
              expect(beforeHook).to.be.true;
              expect(afterHook).to.be.true;
              expect(err).to.be.instanceOf(Error);
              done();
            });
          });
        });
      });
    });
  });

  describe('associations', function() {
    describe('1:1', function() {
      describe('cascade onUpdate', function() {
        beforeEach(function(done) {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onUpdate: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done();
            });
          });
        });

        it('on success', function(done) {
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

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).success(function() {
                project.updateAttributes({id: 2}).success(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        it('on error', function(done) {
          var self = this
            , beforeHook = false
            , afterHook = false;

          this.Tasks.afterUpdate(function(task, options, fn) {
            fn(new Error('Whoops!'));
          });

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });
      });

      describe('cascade onDelete', function() {
        beforeEach(function(done) {
          var self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          this.sequelize.sync({ force: true }).success(function() {
            done();
          });
        });

        describe('#remove', function() {
          it('with no errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.setTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                    done();
                  });
                });
              });
            });
          });

          it('with errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.setTask(task).success(function() {
                  project.destroy().error(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                    done();
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade update', function() {
        beforeEach(function(done) {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done();
            });
          });
        });

        it('on success', function(done) {
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

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).success(function() {
                project.updateAttributes({id: 2}).success(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                  done();
                });
              });
            });
          });
        });

        it('on error', function(done) {
          var self = this
            , beforeHook = false
            , afterHook = false;

          this.Tasks.afterUpdate(function(task, options, fn) {
            fn(new Error('Whoops!'));
          });

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).error(function(err) {
                expect(err).to.be.instanceOf(Error);
                done();
              });
            });
          });
        });
      });

      describe('no cascade delete', function() {
        beforeEach(function(done) {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done();
            });
          });
        });

        describe('#remove', function() {
          it('with no errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.removeTask(task).success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                    done();
                  });
                });
              });
            });
          });

          it('with errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('1:M', function() {
      describe('cascade', function() {
        beforeEach(function(done) {
          var self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects, {hooks: true});

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done();
            });
          });
        });

        describe('#remove', function() {
          it('with no errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                    done();
                  });
                });
              });
            });
          });

          it('with errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().error(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                    done();
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function(done) {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          this.sequelize.sync({ force: true }).success(function() {
            done();
          });
        });

        describe('#remove', function() {
          it('with no errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.removeTask(task).success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.true;
                    done();
                  });
                });
              });
            });
          });

          it('with errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).error(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('M:M', function() {
      describe('cascade', function() {
        beforeEach(function(done) {
          var self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {cascade: 'onDelete', joinTableName: 'projects_and_tasks', hooks: true});
          this.Tasks.hasMany(this.Projects, {cascade: 'onDelete', joinTableName: 'projects_and_tasks', hooks: true});

          this.sequelize.sync({ force: true }).success(function() {
            done();
          });
        });

        describe('#remove', function() {
          it('with no errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    // Since Sequelize does not cascade M:M, these should be false
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                    done();
                  });
                });
              });
            });
          });

          it('with errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                    done();
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function(done) {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {hooks: true});
          this.Tasks.hasMany(this.Projects, {hooks: true});

          this.sequelize.sync({ force: true }).success(function() {
            done();
          });
        });

        describe('#remove', function() {
          it('with no errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.removeTask(task).success(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                    done();
                  });
                });
              });
            });
          });

          it('with errors', function(done) {
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

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.false;
                  expect(afterTask).to.be.false;
                  done();
                });
              });
            });
          });
        });
      });
    });

    describe('multiple 1:M', function () {
      describe('cascade', function() {
        beforeEach(function() {
          var self = this;
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
            var self = this
              , beforeProject = false
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
            var self = this
              , beforeProject = false
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
          var self = this;
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
            var self = this
              , beforeProject = false
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
            var self = this
              , beforeProject = false
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
              fn(new Error('Whoops!'));
              fn();
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
              beforeMiniTask = true;
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
            }).catch(function() {
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

  describe('passing DAO instances', function() {
    describe('beforeValidate / afterValidate', function() {
      it('should pass a DAO instance to the hook', function(done) {
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

        User.sync({ force: true }).success(function() {
          User.create({ username: 'bob' }).success(function(user) {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
            done();
          });
        });
      });
    });

    describe('beforeCreate / afterCreate', function() {
      it('should pass a DAO instance to the hook', function(done) {
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

        User.sync({ force: true }).success(function() {
          User.create({ username: 'bob' }).success(function(user) {
            expect(beforeHooked).to.be.true;
            expect(afterHooked).to.be.true;
            done();
          });
        });
      });
    });

    describe('beforeDestroy / afterDestroy', function() {
      it('should pass a DAO instance to the hook', function(done) {
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

        User.sync({ force: true }).success(function() {
          User.create({ username: 'bob' }).success(function(user) {
            user.destroy().success(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
              done();
            });
          });
        });
      });
    });

    describe('beforeDelete / afterDelete', function() {
      it('should pass a DAO instance to the hook', function(done) {
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

        User.sync({ force: true }).success(function() {
          User.create({ username: 'bob' }).success(function(user) {
            user.destroy().success(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
              done();
            });
          });
        });
      });
    });

    describe('beforeUpdate / afterUpdate', function() {
      it('should pass a DAO instance to the hook', function(done) {
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

        User.sync({ force: true }).success(function() {
          User.create({ username: 'bob' }).success(function(user) {
            user.save({ username: 'bawb' }).success(function() {
              expect(beforeHooked).to.be.true;
              expect(afterHooked).to.be.true;
              done();
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

      this.User.beforeBulkCreate(function(daos, options) {
        hookRun = true;
        return self.sequelize.Promise.resolve();
      });

      return this.User.bulkCreate([
        {username: 'Bob', mood: 'happy'},
        {username: 'Tobi', mood: 'sad'}
      ], { individualHooks: false }).success(function(bulkUsers) {
        return self.User.all().success(function(users) {
          expect(hookRun).to.equal(true);
        });
      });
    });

    it('can return undefined', function() {
      var self = this
        , hookRun = false;

      this.User.beforeBulkCreate(function(daos, options) {
        hookRun = true;
      });

      return this.User.bulkCreate([
        {username: 'Bob', mood: 'happy'},
        {username: 'Tobi', mood: 'sad'}
      ], { individualHooks: false }).success(function(bulkUsers) {
        return self.User.all().success(function(users) {
          expect(hookRun).to.equal(true);
        });
      });
    });

    it('can return an error by rejecting', function() {
      var self = this;

      this.User.beforeCreate(function() {
        return self.sequelize.Utils.Promise.reject(new Error("I'm afraid I can't let you do that"));
      });

      return this.User.create({}).catch (function(err) {
        expect(err.message).to.equal("I'm afraid I can't let you do that");
      });
    });

    it('can return an error by throwing', function() {
      var self = this;

      this.User.beforeCreate(function() {
        throw (new Error("I'm afraid I can't let you do that"));
      });

      return this.User.create({}).catch (function(err) {
        expect(err.message).to.equal("I'm afraid I can't let you do that");
      });
    });
  });
});
