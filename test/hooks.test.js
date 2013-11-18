/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../lib/data-types')
  , _         = require('lodash')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Hooks"), function () {
  describe('#validate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          describe('with returning the user in the callback', function() {
            beforeEach(function(done) {
              this.User = this.sequelize.define('User', {
                username: DataTypes.STRING,
                mood: {
                  type: DataTypes.ENUM,
                  values: ['happy', 'sad', 'neutral']
                }
              }, {
                hooks: {
                  beforeValidate: function(user, fn) {
                    user.mood = 'happy'
                    fn(null, user)
                  },
                  afterValidate: function(user, fn) {
                    user.username = 'Toni'
                    fn(null, user)
                  }
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#bulkCreate', function() {
              describe('with no specific DAO hooks', function() {
                it('should return with a callback', function(done) {
                  var self             = this
                    , beforeBulkCreate = false
                    , afterBulkCreate  = false

                  this.User.beforeBulkCreate(function(daos, fields, fn) {
                    beforeBulkCreate = true
                    daos = daos.map(function(d) {
                      d.mood = 'happy'
                      return d
                    })

                    fn(null, daos, fields)
                  })

                  this.User.afterBulkCreate(function(daos, fields, fn) {
                    afterBulkCreate = true

                    fn(null, daos, fields)
                  })

                  this.User.bulkCreate([
                    {username: 'Bob', mood: 'cold'},
                    {username: 'Tobi', mood: 'hot'}
                  ]).success(function() {
                    self.User.all().success(function(users) {
                      expect(beforeBulkCreate).to.be.true
                      expect(afterBulkCreate).to.be.true
                      expect(users[0].mood).to.equal('happy')
                      expect(users[1].mood).to.equal('happy')
                      done()
                    })
                  })
                })
              })

              describe('with specific DAO hooks', function() {
                it('should return with a callback', function(done) {
                  var self             = this
                    , beforeBulkCreate = false
                    , afterBulkCreate  = false

                  this.User.beforeBulkCreate(function(daos, fields, fn) {
                    beforeBulkCreate = true
                    daos = daos.map(function(d) {
                      d.mood = 'happy happy joy hoy'
                      return d
                    })

                    fn(null, daos, fields)
                  })

                  this.User.afterBulkCreate(function(daos, fields, fn) {
                    afterBulkCreate = true

                    fn(null, daos, fields)
                  })

                  this.User.bulkCreate([
                    {username: 'Bob', mood: 'cold'},
                    {username: 'Tobi', mood: 'hot'}
                  ], { fields: [], hooks: true }).success(function(bulkUsers) {
                    expect(beforeBulkCreate).to.be.true
                    expect(afterBulkCreate).to.be.true
                    expect(bulkUsers).to.be.instanceof(Array)
                    expect(bulkUsers).to.have.length(2)
                    expect(bulkUsers[0].mood).to.equal('happy')
                    expect(bulkUsers[1].mood).to.equal('happy')

                    self.User.all().success(function(users) {
                      expect(users[0].mood).to.equal('happy')
                      expect(users[0].mood).to.equal('happy')
                      done()
                    })
                  })
                })
              })
            })

            it('#create', function(done) {
              this.User.create({mood: 'ecstatic'}).success(function(user) {
                expect(user.mood).to.equal('happy')
                expect(user.username).to.equal('Toni')
                done()
              })
            })

            it('#save', function(done) {
              this.User.create({mood: 'sad'}).success(function(user) {
                user.mood = 'ecstatic'
                user.save().success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })

            it('#updateAttributes / update', function(done) {
              this.User.create({mood: 'sad'}).success(function(user) {
                user.updateAttributes({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })

            it('#update / bulkUpdate', function(done) {
              var self = this
                , beforeBulkUpdate = false
                , afterBulkUpdate  = false

              this.User.beforeBulkUpdate(function(daos, fields, fn) {
                beforeBulkUpdate = true

                fn(null, daos, fields)
              })

              this.User.afterBulkUpdate(function(daos, fields, fn) {
                afterBulkUpdate = true

                fn(null, daos, fields)
              })

              this.User.create({mood: 'sad'}).success(function() {
                self.User.update({mood: 'ecstatic'}, {username: 'Toni'}, {validate: true}).success(function() {
                  self.User.find({where: {username: 'Toni'}}).success(function(user) {
                    expect(beforeBulkUpdate).to.be.true
                    expect(afterBulkUpdate).to.be.true
                    expect(user.mood).to.equal('happy')
                    expect(user.username).to.equal('Toni')
                    done()
                  })
                })
              })
            })
          })

          describe('without returning the user in the callback', function() {
            beforeEach(function(done) {
              this.User = this.sequelize.define('User', {
                username: DataTypes.STRING,
                mood: {
                  type: DataTypes.ENUM,
                  values: ['happy', 'sad', 'neutral']
                }
              }, {
                hooks: {
                  beforeValidate: function(user, fn) {
                    user.mood = 'happy'
                    fn()
                  },
                  afterValidate: function(user, fn) {
                    user.username = 'Toni'
                    fn()
                  }
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#bulkCreate', function() {
              describe('with no specific DAO hooks', function() {
                it('should return without a defined callback', function(done) {
                  var self = this
                    , beforeBulkCreate  = false
                    , afterBulkCreate   = false

                  this.User.beforeBulkCreate(function(daos, fields, fn) {
                    beforeBulkCreate = true
                    daos = daos.map(function(d) {
                      d.mood = 'happy'
                      return d
                    })

                    fn()
                  })

                  this.User.afterBulkCreate(function(daos, fields, fn) {
                    afterBulkCreate = true

                    fn()
                  })

                  this.User.bulkCreate([
                    {username: 'Bob', mood: 'cold'},
                    {username: 'Tobi', mood: 'hot'}
                  ]).success(function() {
                    self.User.all().success(function(users) {
                      expect(beforeBulkCreate).to.be.true
                      expect(afterBulkCreate).to.be.true
                      expect(users[0].mood).to.equal('happy')
                      expect(users[0].mood).to.equal('happy')
                      done()
                    })
                  })
                })
              })

              describe('with specific DAO hooks', function() {
                it('should return without a defined callback', function(done) {
                  var self = this
                    , beforeBulkCreate = false
                    , afterBulkCreate  = false

                  this.User.beforeBulkCreate(function(daos, fields, fn) {
                    beforeBulkCreate = true
                    daos = daos.map(function(d) {
                      d.mood = 'happy'
                      return d
                    })

                    fn()
                  })

                  this.User.afterBulkCreate(function(daos, fields, fn) {
                    afterBulkCreate = true

                    fn()
                  })

                  this.User.bulkCreate([
                    {username: 'Bob', mood: 'cold'},
                    {username: 'Tobi', mood: 'hot'}
                  ], { hooks: true }).success(function(bulkUsers) {
                    expect(beforeBulkCreate).to.be.true
                    expect(afterBulkCreate).to.be.true
                    expect(bulkUsers).to.be.instanceof(Array)
                    expect(bulkUsers).to.have.length(2)

                    self.User.all().success(function(users) {
                      expect(users[0].mood).to.equal('happy')
                      expect(users[1].mood).to.equal('happy')
                      done()
                    })
                  })
                })
              })
            })

            describe('#create', function() {
              it('should return the user', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })

            it('#updateAttributes / update', function(done) {
              this.User.create({mood: 'sad'}).success(function(user) {
                user.updateAttributes({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })

            it('#update / bulkUpdate', function(done) {
              var self = this
                , beforeBulkUpdate = false
                , afterBulkUpdate  = false

              this.User.beforeBulkUpdate(function(daos, fields, fn) {
                beforeBulkUpdate = true

                fn(null, daos, fields)
              })

              this.User.afterBulkUpdate(function(daos, fields, fn) {
                afterBulkUpdate = true

                fn(null, daos, fields)
              })

              this.User.create({mood: 'sad'}).success(function() {
                self.User.update({mood: 'ecstatic'}, {username: 'Toni'}, {validate: true}).success(function() {
                  self.User.find({where: {username: 'Toni'}}).success(function(user) {
                    expect(beforeBulkUpdate).to.be.true
                    expect(afterBulkUpdate).to.be.true
                    expect(user.mood).to.equal('happy')
                    expect(user.username).to.equal('Toni')
                    done()
                  })
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('with returning the user in the callback', function() {
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
                    function(user, fn) {
                      user.mood = 'joyful'
                      fn(null, user)
                    },
                    function(user, fn) {
                      user.mood = 'happy'
                      fn(null, user)
                    }
                  ],
                  afterValidate: [
                    function(user, fn) {
                      user.username = 'Tobi'
                      fn(null, user)
                    },
                    function(user, fn) {
                      user.username = 'Toni'
                      fn(null, user)
                    }
                  ]
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#create', function() {
              it('should return the user with a defined callback', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })


            it('should return the user without a defined callback', function(done) {
              var User = this.sequelize.define('User', {
                username: DataTypes.STRING,
                mood: {
                  type: DataTypes.ENUM,
                  values: ['happy', 'sad', 'neutral']
                }
              }, {
                hooks: {
                  beforeValidate: [
                    function(user, fn) {
                      user.mood = 'joyful'
                      fn()
                    },
                    function(user, fn) {
                      user.mood = 'happy'
                      fn()
                    }
                  ],
                  afterValidate: [
                    function(user, fn) {
                      user.username = 'Tobi'
                      fn()
                    },
                    function(user, fn) {
                      user.username = 'Toni'
                      fn()
                    }
                  ]
                }
              })

              User.sync({ force: true }).success(function() {
                User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          describe('with returning the user in the callback', function() {
            beforeEach(function(done) {
              this.User = this.sequelize.define('User', {
                username: DataTypes.STRING,
                mood: {
                  type: DataTypes.ENUM,
                  values: ['happy', 'sad', 'neutral']
                }
              }, {
                hooks: {
                  beforeValidate: function(user, fn) {
                    user.mood = 'ecstatic'
                    fn(null, user)
                  },
                  afterValidate: function(user, fn) {
                    user.username = 'Toni'
                    fn(null, user)
                  }
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#create', function() {
              it('should return an error based on user', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })
          })

          describe('without returning the user in the callback', function() {
            beforeEach(function(done) {
              this.User = this.sequelize.define('User', {
                username: DataTypes.STRING,
                mood: {
                  type: DataTypes.ENUM,
                  values: ['happy', 'sad', 'neutral']
                }
              }, {
                hooks: {
                  beforeValidate: function(user, fn) {
                    user.mood = 'ecstatic'
                    fn()
                  },
                  afterValidate: function(user, fn) {
                    user.username = 'Toni'
                    fn()
                  }
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#create', function() {
              it('should return an error based on the hook', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('with returning the user in the callback', function() {
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
                    function(user, fn) {
                      user.mood = 'happy'
                      fn(null, user)
                    },
                    function(user, fn) {
                      user.mood = 'ecstatic'
                      fn(null, user)
                    }
                  ],
                  afterValidate: [
                    function(user, fn) {
                      user.username = 'Tobi'
                      fn(null, user)
                    },
                    function(user, fn) {
                      user.username = 'Toni'
                      fn(null, user)
                    }
                  ]
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#create', function() {
              it('should return an error based on user', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })
          })

          describe('without returning the user in the callback', function() {
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
                    function(user, fn) {
                      user.mood = 'happy'
                      fn()
                    },
                    function(user, fn) {
                      user.mood = 'ecstatic'
                      fn()
                    }
                  ],
                  afterValidate: [
                    function(user, fn) {
                      user.username = 'Tobi'
                      fn()
                    },
                    function(user, fn) {
                      user.username = 'Toni'
                      fn()
                    }
                  ]
                }
              })

              this.User.sync({ force: true }).success(function() {
                done()
              })
            })

            describe('#create', function() {
              it('should return an error based on the hook', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('should run hooks while returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.mood = 'happy'
                  fn(null, user)
                })

                this.User.afterValidate(function(user, fn) {
                  user.username = 'Toni'
                  fn(null, user)
                })

                done()
              })

              describe('#create', function() {
                it('should return the user from the callback', function(done) {
                  this.User.create({mood: 'ecstatic'}).success(function(user) {
                    expect(user.mood).to.equal('happy')
                    expect(user.username).to.equal('Toni')
                    done()
                  })
                })
              })
            })

            describe('should run hooks without returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.mood = 'happy'
                  fn(null, user)
                })

                this.User.afterValidate(function(user, fn) {
                  user.username = 'Toni'
                  fn(null, user)
                })

                done()
              })

              describe('#create', function() {
                it('should return the user', function(done) {
                  this.User.create({mood: 'ecstatic'}).success(function(user) {
                    expect(user.mood).to.equal('happy')
                    expect(user.username).to.equal('Toni')
                    done()
                  })
                })
              })
            })
          })

          describe('on error', function() {
            describe('should run hooks while returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.username = 'Toni'
                  user.mood = 'ecstatic'
                  fn(null, user)
                })

                done()
              })

              describe('#create', function() {
                it('should return the user from the callback', function(done) {
                  this.User.create({mood: 'happy'}).error(function(err) {
                    expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                    done()
                  })
                })
              })
            })

            describe('should run hooks without returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.username = 'Toni'
                  user.mood = 'ecstatic'
                  fn(null)
                })

                done()
              })

              describe('#create', function() {
                it('should return the error without the user within callback', function(done) {
                  this.User.create({mood: 'happy'}).error(function(err) {
                    expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                    done()
                  })
                })
              })
            })

            describe('should emit an error from after hook', function() {
              beforeEach(function(done) {
                this.User.afterValidate(function(user, fn) {
                  user.mood = 'ecstatic'
                  fn('Whoops! Changed user.mood!')
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.equal('Whoops! Changed user.mood!')
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('should run hooks while returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.mood = 'joyful'
                  fn(null, user)
                })

                this.User.beforeValidate(function(user, fn) {
                  if (user.mood === "joyful") {
                    user.mood = 'happy'
                  }
                  fn(null, user)
                })

                this.User.afterValidate(function(user, fn) {
                  user.username = 'Toni'
                  fn(null, user)
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })

            describe('should run hooks without returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.mood = 'joyful'
                  fn()
                })

                this.User.beforeValidate(function(user, fn) {
                  if (user.mood === "joyful") {
                    user.mood = 'happy'
                  }
                  fn()
                })

                this.User.afterValidate(function(user, fn) {
                  user.username = 'Toni'
                  fn()
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            describe('should run hooks while returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.username = 'Toni'
                  user.mood = 'happy'

                  fn(null, user)
                })

                this.User.beforeValidate(function(user, fn) {
                  user.username = 'Toni'
                  user.mood = 'ecstatic'

                  fn(null, user)
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'creative'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })

            describe('should run hooks without returning a user', function() {
              beforeEach(function(done) {
                this.User.beforeValidate(function(user, fn) {
                  user.username = 'Toni'
                  fn()
                })

                this.User.beforeValidate(function(user, fn) {
                  user.mood = 'ecstatic'
                  fn()
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })

            describe('should emit an error from after hook', function() {
              beforeEach(function(done) {
                this.User.afterValidate(function(user, fn) {
                  user.mood = 'ecstatic'
                  fn()
                })

                this.User.afterValidate(function(user, fn) {
                  fn('Whoops! Changed user.mood!')
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.equal('Whoops! Changed user.mood!')
                  done()
                })
              })
            })
          })
        })
      })

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('success', function() {
            it('should run hooks on #create while returning a user', function(done) {
              this.User.hook('beforeValidate', function(user, fn) {
                user.mood = 'happy'
                fn(null, user)
              })

              this.User.hook('afterValidate', function(user, fn) {
                user.username = 'Toni'
                fn(null, user)
              })

              this.User.create({mood: 'ecstatic'}).success(function(user) {
                expect(user.mood).to.equal('happy')
                expect(user.username).to.equal('Toni')
                done()
              })
            })

            it('should run hooks on #create without returning a user', function(done) {
              this.User.hook('beforeValidate', function(user, fn) {
                user.mood = 'happy'
                fn()
              })

              this.User.hook('afterValidate', function(user, fn) {
                user.username = 'Toni'
                fn()
              })

              this.User.create({mood: 'ecstatic'}).success(function(user) {
                expect(user.mood).to.equal('happy')
                expect(user.username).to.equal('Toni')
                done()
              })
            })
          })

          describe('error', function() {
            it('should emit an error from before hook while the user is being returned', function(done) {
              this.User.hook('beforeValidate', function(user, fn) {
                user.username = 'Toni'
                user.mood = 'ecstatic'
                fn(null, user)
              })

              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                done()
              })
            })

            it('should emit an error from before hook without the user being returned', function(done) {
              this.User.hook('beforeValidate', function(user, fn) {
                user.username = 'Toni'
                user.mood = 'ecstatic'
                fn(null)
              })

              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                done()
              })
            })

            it('should emit an error from after hook', function(done) {
              this.User.hook('afterValidate', function(user, fn) {
                user.mood = 'ecstatic'
                fn('Whoops! Changed user.mood!')
              })

              this.User.create({mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops! Changed user.mood!')
                done()
              })
            })
          })
        })

        describe('multiple hooks', function() {
          describe('on success', function() {
            describe('should run hooks while returning a user', function() {
              beforeEach(function(done) {
                this.User.hook('beforeValidate', function(user, fn) {
                  user.mood = 'joyful'
                  fn(null, user)
                })

                this.User.hook('beforeValidate', function(user, fn) {
                  if (user.mood === "joyful") {
                    user.mood = 'happy'
                  }
                  fn(null, user)
                })

                this.User.hook('afterValidate', function(user, fn) {
                  user.username = 'Toni'
                  fn(null, user)
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })

            describe('should run hooks without returning a user', function() {
              beforeEach(function(done) {
                this.User.hook('beforeValidate', function(user, fn) {
                  user.mood = 'joyful'
                  fn()
                })

                this.User.hook('beforeValidate', function(user, fn) {
                  if (user.mood === "joyful") {
                    user.mood = 'happy'
                  }
                  fn()
                })

                this.User.hook('afterValidate', function(user, fn) {
                  user.username = 'Toni'
                  fn()
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'ecstatic'}).success(function(user) {
                  expect(user.mood).to.equal('happy')
                  expect(user.username).to.equal('Toni')
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            describe('should emit an error from before hook while the user is being returned', function() {
              beforeEach(function(done) {
                this.User.hook('beforeValidate', function(user, fn) {
                  user.username = 'Toni'
                  user.mood = 'happy'

                  fn(null, user)
                })

                this.User.hook('beforeValidate', function(user, fn) {
                  user.username = 'Toni'
                  user.mood = 'ecstatic'

                  fn(null, user)
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'creative'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })

            describe('should emit an error from before hook without the user is being returned', function() {
              beforeEach(function(done) {
                this.User.hook('beforeValidate', function(user, fn) {
                  user.username = 'Toni'
                  fn()
                })

                this.User.hook('beforeValidate', function(user, fn) {
                  user.mood = 'ecstatic'
                  fn()
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.deep.equal({ mood: [ 'Value "ecstatic" for ENUM mood is out of allowed scope. Allowed values: happy, sad, neutral' ] })
                  done()
                })
              })
            })

            describe('should emit an error from after hook', function() {
              beforeEach(function(done) {
                this.User.hook('afterValidate', function(user, fn) {
                  user.mood = 'ecstatic'
                  fn()
                })

                this.User.hook('afterValidate', function(user, fn) {
                  fn('Whoops! Changed user.mood!')
                })

                done()
              })

              it('#create', function(done) {
                this.User.create({mood: 'happy'}).error(function(err) {
                  expect(err).to.equal('Whoops! Changed user.mood!')
                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  describe('#create', function() {
    describe('via deifne', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should return the user from the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, fn) {
                  beforeHook = true
                  attributes.mood = 'happy'
                  fn(null, attributes)
                },
                afterCreate: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                expect(user.mood).to.equal('happy')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('without returning the user in the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, fn) {
                  beforeHook = true
                  attributes.mood = 'happy'
                  fn()
                },
                afterCreate: function(attributes, fn) {
                  afterHook = true
                  fn()
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                expect(user.mood).to.equal('happy')
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          it('should return the user from the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'joyful'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'happy'
                    fn(null, attributes)
                  }
                ],
                afterCreate: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                expect(user.mood).to.equal('happy')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('without returning the user in the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'joyful'
                    fn()
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'happy'
                    fn()
                  }
                ],
                afterCreate: [
                  function(attributes, fn) {
                    afterHook = true
                    fn()
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                expect(user.mood).to.equal('happy')
                done()
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, fn) {
                  beforeHook = true
                  fn('Whoops!', attributes)
                },
                afterCreate: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.false
                done()
              })
            })
          })

          it('from after', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: function(attributes, fn) {
                  beforeHook = true
                  fn()
                },
                afterCreate: function(attributes, fn) {
                  afterHook = true
                  fn('Whoops!')
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          it('from before', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, fn) {
                    beforeHook = 'fake'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    fn('Whoops!', attributes)
                  },
                ],
                afterCreate: [
                  function(attributes, fn) {
                    afterHook = true
                    fn(null, attributes)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.false
                done()
              })
            })
          })

          it('from after', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeCreate: [
                  function(attributes, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterCreate: [
                  function(attributes, fn) {
                    afterHook = 'fake'
                    fn()
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn('Whoops!')
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({force: true}).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.false
                done()
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = 'hi'
                fn()
              })

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = 'hi'
                fn()
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.false
                done()
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeCreate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.afterCreate(function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.false
                done()
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = 'hi'
                fn()
              })

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = 'hi'
                fn()
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.false
                done()
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeCreate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.hook('afterCreate', function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })
    })
  })

  describe('#updateAttributes', function() {
    describe('via deifne', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should return the user from the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, fn) {
                  beforeHook = true
                  attributes.mood = 'happy'
                  fn(null, attributes)
                },
                afterUpdate: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  expect(user.mood).to.equal('happy')
                  done()
                })
              })
            })
          })

          it('without returning the user in the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, fn) {
                  beforeHook = true
                  attributes.mood = 'happy'
                  fn()
                },
                afterUpdate: function(attributes, fn) {
                  afterHook = true
                  fn()
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  expect(user.mood).to.equal('happy')
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          it('should return the user from the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'joyful'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'happy'
                    fn(null, attributes)
                  }
                ],
                afterUpdate: [
                  function(attributes, fn) {
                    afterHook = 'hi'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn(null, attributes)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(user.username).to.equal('Chong')
                  expect(user.mood).to.equal('happy')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('without returning the user in the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'joyful'
                    fn()
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'happy'
                    fn()
                  }
                ],
                afterUpdate: [
                  function(attributes, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn()
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  expect(user.mood).to.equal('happy')
                  done()
                })
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, fn) {
                  beforeHook = true
                  fn('Whoops!', attributes)
                },
                afterUpdate: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })
          })

          it('from after', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: function(attributes, fn) {
                  beforeHook = true
                  fn()
                },
                afterUpdate: function(attributes, fn) {
                  afterHook = true
                  fn('Whoops!')
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          it('from before', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, fn) {
                    beforeHook = 'fake'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    fn('Whoops!', attributes)
                  },
                ],
                afterUpdate: [
                  function(attributes, fn) {
                    afterHook = true
                    fn(null, attributes)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })
          })

          it('from after', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeUpdate: [
                  function(attributes, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterUpdate: [
                  function(attributes, fn) {
                    afterHook = 'fake'
                    fn()
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn('Whoops!')
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({force: true}).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = 'hi'
                fn()
              })

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = 'hi'
                fn()
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeUpdate(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.afterUpdate(function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = 'hi'
                fn()
              })

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = 'hi'
                fn()
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  expect(user.username).to.equal('Chong')
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeUpdate', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.hook('afterUpdate', function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.updateAttributes({username: 'Chong'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  describe('#destroy', function() {
    describe('via deifne', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should return the user from the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, fn) {
                  beforeHook = true
                  fn(null, attributes)
                },
                afterDestroy: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('without returning the user in the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, fn) {
                  beforeHook = true
                  fn()
                },
                afterDestroy: function(attributes, fn) {
                  afterHook = true
                  fn()
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          it('should return the user from the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'joyful'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'happy'
                    fn(null, attributes)
                  }
                ],
                afterDestroy: [
                  function(attributes, fn) {
                    afterHook = 'hi'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn(null, attributes)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('without returning the user in the callback', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'joyful'
                    fn()
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    attributes.mood = 'happy'
                    fn()
                  }
                ],
                afterDestroy: [
                  function(attributes, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn()
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          it('from before', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, fn) {
                  beforeHook = true
                  fn('Whoops!', attributes)
                },
                afterDestroy: function(attributes, fn) {
                  afterHook = true
                  fn(null, attributes)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })
          })

          it('from after', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: function(attributes, fn) {
                  beforeHook = true
                  fn()
                },
                afterDestroy: function(attributes, fn) {
                  afterHook = true
                  fn('Whoops!')
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          it('from before', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, fn) {
                    beforeHook = 'fake'
                    fn(null, attributes)
                  },
                  function(attributes, fn) {
                    beforeHook = true
                    fn('Whoops!', attributes)
                  },
                ],
                afterDestroy: [
                  function(attributes, fn) {
                    afterHook = true
                    fn(null, attributes)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })
          })

          it('from after', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeDestroy: [
                  function(attributes, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterDestroy: [
                  function(attributes, fn) {
                    afterHook = 'fake'
                    fn()
                  },
                  function(attributes, fn) {
                    afterHook = true
                    fn('Whoops!')
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.create({username: 'Cheech', mood: 'sad'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({force: true}).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = 'hi'
                fn()
              })

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = 'hi'
                fn()
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.beforeDestroy(function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.afterDestroy(function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })

      describe('.hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            it('should return with the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })

            it('should return without the values', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = 'hi'
                fn()
              })

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn()
              })

              this.User.hook('afterDestory', function(user, fn) {
                afterHook = 'hi'
                fn()
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn()
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().success(function(user) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = 'hi'
                fn(null, user)
              })

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn('Whoops!', user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn(null, user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.false
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var beforeHook = false
                , afterHook = false

              this.User.hook('beforeDestroy', function(user, fn) {
                beforeHook = true
                fn(null, user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = 'hi'
                fn(null, user)
              })

              this.User.hook('afterDestroy', function(user, fn) {
                afterHook = true
                fn('Whoops!', user)
              })

              this.User.create({username: 'Toni', mood: 'happy'}).success(function(user) {
                user.destroy().error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  describe('#bulkCreate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: function(attributes, where, fn) {
                  beforeHook = true
                  fn(null, attributes, where)
                },
                afterBulkCreate: function(attributes, where, fn) {
                  afterHook = true
                  fn(null, attributes, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: function(attributes, where, fn) {
                  beforeHook = true
                  fn(null, attributes, where)
                },
                afterBulkCreate: function(attributes, where, fn) {
                  afterHook = true
                  fn(null, attributes, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
         it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn(null, attributes, where)
                  }
                ],
                afterBulkCreate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn(null, attributes, where)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterBulkCreate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn()
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: function(attributes, where, fn) {
                  beforeHook = true
                  fn(null, attributes, where)
                },
                afterBulkCreate: function(attributes, where, fn) {
                  afterHook = true
                  fn('Whoops!', attributes, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: function(attributes, where, fn) {
                  beforeHook = true
                  fn()
                },
                afterBulkCreate: function(attributes, where, fn) {
                  afterHook = true
                  fn('Whoops!')
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
         it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn(null, attributes, where)
                  }
                ],
                afterBulkCreate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn('Whoops!', attributes, where)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkCreate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterBulkCreate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn('Whoops!')
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkCreate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.afterBulkCreate(function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkCreate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.afterBulkCreate(function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkCreate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.afterBulkCreate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkCreate(function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn(null, daos, fields)
                })

                this.User.beforeBulkCreate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.afterBulkCreate(function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkCreate(function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn()
                })


                this.User.beforeBulkCreate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.afterBulkCreate(function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkCreate(function(daos, fields, fn) {
                fn()
              })

              this.User.beforeBulkCreate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.afterBulkCreate(function(daos, fields, fn) {
                fn()
              })

              this.User.afterBulkCreate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })
      })

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn(null, daos, fields)
                })

                this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn()
                })


                this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                fn()
              })

              this.User.hook('beforeBulkCreate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                fn()
              })

              this.User.hook('afterBulkCreate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })
      })
    })

    describe('with the {hooks: true} option', function() {
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
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      it('should run the afterCreate/beforeCreate functions for each item created successfully', function(done) {
        var beforeBulkCreate = false
          , afterBulkCreate  = false

        this.User.beforeBulkCreate(function(daos, fields, fn) {
          beforeBulkCreate = true
          fn()
        })

        this.User.afterBulkCreate(function(daos, fields, fn) {
          afterBulkCreate = true
          fn()
        })

        this.User.beforeCreate(function(user, fn) {
          user.beforeHookTest = true
          fn()
        })

        this.User.afterCreate(function(user, fn) {
          user.username = 'User' + user.id
          fn()
        })

        this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], hooks: true }).success(function(records) {
          records.forEach(function(record) {
            expect(record.username).to.equal('User' + record.id)
            expect(record.beforeHookTest).to.be.true
          })
          expect(beforeBulkCreate).to.be.true
          expect(afterBulkCreate).to.be.true
          done()
        })
      })

      it('should run the afterCreate/beforeCreate functions for each item created with an error', function(done) {
        var beforeBulkCreate = false
          , afterBulkCreate  = false

        this.User.beforeBulkCreate(function(daos, fields, fn) {
          beforeBulkCreate = true
          fn()
        })

        this.User.afterBulkCreate(function(daos, fields, fn) {
          afterBulkCreate = true
          fn()
        })

        this.User.beforeCreate(function(user, fn) {
          fn('You shall not pass!')
        })

        this.User.afterCreate(function(user, fn) {
          user.username = 'User' + user.id
          fn()
        })

        this.User.bulkCreate([{aNumber: 5}, {aNumber: 7}, {aNumber: 3}], { fields: ['aNumber'], hooks: true }).error(function(err) {
          expect(err).to.equal('You shall not pass!')
          expect(beforeBulkCreate).to.be.true
          expect(afterBulkCreate).to.be.false
          done()
        })
      })
    })
  })

  describe('#bulkUpdate', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: function(attributes, where, fn) {
                  beforeHook = true
                  fn(null, attributes, where)
                },
                afterBulkUpdate: function(attributes, where, fn) {
                  afterHook = true
                  fn(null, attributes, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: function(attributes, where, fn) {
                  beforeHook = true
                  fn(null, attributes, where)
                },
                afterBulkUpdate: function(attributes, where, fn) {
                  afterHook = true
                  fn(null, attributes, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
         it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn(null, attributes, where)
                  }
                ],
                afterBulkUpdate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn(null, attributes, where)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterBulkUpdate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn()
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: function(attributes, where, fn) {
                  beforeHook = true
                  fn(null, attributes, where)
                },
                afterBulkUpdate: function(attributes, where, fn) {
                  afterHook = true
                  fn('Whoops!', attributes, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: function(attributes, where, fn) {
                  beforeHook = true
                  fn()
                },
                afterBulkUpdate: function(attributes, where, fn) {
                  afterHook = true
                  fn('Whoops!')
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
         it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn(null, attributes, where)
                  }
                ],
                afterBulkUpdate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn(null, attributes, where)
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn('Whoops!', attributes, where)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkUpdate: [
                  function(attributes, where, fn) {
                    beforeHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterBulkUpdate: [
                  function(attributes, where, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(attributes, where, fn) {
                    afterHook = true
                    fn('Whoops!')
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkUpdate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.afterBulkUpdate(function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkUpdate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.afterBulkUpdate(function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this

              this.User.beforeBulkUpdate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var self = this

              this.User.afterBulkUpdate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkUpdate(function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn(null, daos, fields)
                })

                this.User.beforeBulkUpdate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.afterBulkUpdate(function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkUpdate(function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn()
                })


                this.User.beforeBulkUpdate(function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.afterBulkUpdate(function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this

              this.User.beforeBulkUpdate(function(daos, fields, fn) {
                fn()
              })

              this.User.beforeBulkUpdate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var self = this

              this.User.afterBulkUpdate(function(daos, fields, fn) {
                fn()
              })

              this.User.afterBulkUpdate(function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })
          })
        })
      })

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this

              this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var self = this

              this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn(null, daos, fields)
                })

                this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn(null, daos, fields)
                })

                this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                  afterBulk = true
                  fn(null, daos, fields)
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                  beforeBulk = 'hi'
                  fn()
                })


                this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.bulkCreate([
                  {username: 'Cheech', mood: 'sad'},
                  {username: 'Chong', mood: 'sad'}
                ]).success(function() {
                  self.User.update({mood: 'happy'}, {mood: 'sad'}).success(function() {
                    expect(beforeBulk).to.be.true
                    expect(afterBulk).to.be.true
                    done()
                  })
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              var self = this

              this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                fn()
              })

              this.User.hook('beforeBulkUpdate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })

            it('should return an error from after', function(done) {
              var self = this

              this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                fn()
              })

              this.User.hook('afterBulkUpdate', function(daos, fields, fn) {
                fn('Whoops!')
              })

              this.User.bulkCreate([
                {username: 'Cheech', mood: 'sad'},
                {username: 'Chong', mood: 'sad'}
              ]).success(function() {
                self.User.update({mood: 'happy'}, {mood: 'sad'}).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('with the {hooks: true} option', function() {
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
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      it('should run the after/before functions for each item created successfully', function(done) {
        var self       = this
          , beforeBulk = false
          , afterBulk  = false

        this.User.beforeBulkUpdate(function(daos, fields, fn) {
          beforeBulk = true
          fn()
        })

        this.User.afterBulkUpdate(function(daos, fields, fn) {
          afterBulk = true
          fn()
        })

        this.User.beforeUpdate(function(user, fn) {
          user.beforeHookTest = true
          fn()
        })

        this.User.afterUpdate(function(user, fn) {
          user.username = 'User' + user.id
          fn()
        })


        this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).success(function() {
          self.User.update({aNumber: 10}, {aNumber: 1}, {hooks: true}).success(function(records) {
            records.forEach(function(record) {
              expect(record.username).to.equal('User' + record.id)
              expect(record.beforeHookTest).to.be.true
            })
            expect(beforeBulk).to.be.true
            expect(afterBulk).to.be.true
            done()
          })
        })
      })

      it('should run the after/before functions for each item created with an error', function(done) {
        var self       = this
          , beforeBulk = false
          , afterBulk  = false

        this.User.beforeBulkUpdate(function(daos, fields, fn) {
          beforeBulk = true
          fn()
        })

        this.User.afterBulkUpdate(function(daos, fields, fn) {
          afterBulk = true
          fn()
        })

        this.User.beforeUpdate(function(user, fn) {
          fn('You shall not pass!')
        })

        this.User.afterUpdate(function(user, fn) {
          user.username = 'User' + user.id
          fn()
        })

        this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).success(function() {
          self.User.update({aNumber: 10}, {aNumber: 1}, {hooks: true}).error(function(err) {
            expect(err).to.equal('You shall not pass!')
            expect(beforeBulk).to.be.true
            expect(afterBulk).to.be.false
            done()
          })
        })
      })
    })
  })

  describe('#bulkDestroy', function() {
    describe('via define', function() {
      describe('on success', function() {
        describe('with a single hook', function() {
          it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: function(where, fn) {
                  beforeHook = true
                  fn(null, where)
                },
                afterBulkDestroy: function(where, fn) {
                  afterHook = true
                  fn(null, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: function(where, fn) {
                  beforeHook = true
                  fn(null, where)
                },
                afterBulkDestroy: function(where, fn) {
                  afterHook = true
                  fn(null, where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
         it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: [
                  function(where, fn) {
                    beforeHook = 'hi'
                    fn(null, where)
                  },
                  function(where, fn) {
                    beforeHook = true
                    fn(null, where)
                  }
                ],
                afterBulkDestroy: [
                  function(where, fn) {
                    afterHook = 'hi'
                    fn(null, where)
                  },
                  function(where, fn) {
                    afterHook = true
                    fn(null, where)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: [
                  function(where, fn) {
                    beforeHook = 'hi'
                    fn()
                  },
                  function(where, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterBulkDestroy: [
                  function(where, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(where, fn) {
                    afterHook = true
                    fn()
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })

      describe('on error', function() {
        describe('with a single hook', function() {
          it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: function(where, fn) {
                  beforeHook = true
                  fn(null, where)
                },
                afterBulkDestroy: function(where, fn) {
                  afterHook = true
                  fn('Whoops!', where)
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: function(where, fn) {
                  beforeHook = true
                  fn()
                },
                afterBulkDestroy: function(where, fn) {
                  afterHook = true
                  fn('Whoops!')
                }
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
         it('should return while returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: [
                  function(where, fn) {
                    beforeHook = 'hi'
                    fn(null, where)
                  },
                  function(where, fn) {
                    beforeHook = true
                    fn(null, where)
                  }
                ],
                afterBulkDestroy: [
                  function(where, fn) {
                    afterHook = 'hi'
                    fn(null, where)
                  },
                  function(where, fn) {
                    afterHook = true
                    fn('Whoops!', where)
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })

          it('should return without returning values', function(done) {
            var beforeHook = false
              , afterHook  = false

            var User = this.sequelize.define('User', {
              username: DataTypes.STRING,
              mood: {
                type: DataTypes.ENUM,
                values: ['happy', 'sad', 'neutral']
              }
            }, {
              hooks: {
                beforeBulkDestroy: [
                  function(where, fn) {
                    beforeHook = 'hi'
                    fn()
                  },
                  function(where, fn) {
                    beforeHook = true
                    fn()
                  }
                ],
                afterBulkDestroy: [
                  function(where, fn) {
                    afterHook = 'hi'
                    fn()
                  },
                  function(where, fn) {
                    afterHook = true
                    fn('Whoops!')
                  }
                ]
              }
            })

            User.sync({ force: true }).success(function() {
              User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                expect(beforeHook).to.be.true
                expect(afterHook).to.be.true
                done()
              })
            })
          })
        })
      })
    })

    describe('via DAOFactory', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          mood: {
            type: DataTypes.ENUM,
            values: ['happy', 'sad', 'neutral']
          }
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      describe('direct method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkDestroy(function(where, fn) {
                  beforeBulk = true
                  fn(null, where)
                })

                this.User.afterBulkDestroy(function(where, fn) {
                  afterBulk = true
                  fn(null, where)
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkDestroy(function(where, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.afterBulkDestroy(function(where, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkDestroy(function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.afterBulkDestroy(function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkDestroy(function(where, fn) {
                  beforeBulk = 'hi'
                  fn(null, where)
                })

                this.User.beforeBulkDestroy(function(where, fn) {
                  beforeBulk = true
                  fn(null, where)
                })

                this.User.afterBulkDestroy(function(where, fn) {
                  afterBulk = true
                  fn(null, where)
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.beforeBulkDestroy(function(where, fn) {
                  beforeBulk = 'hi'
                  fn()
                })


                this.User.beforeBulkDestroy(function(where, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.afterBulkDestroy(function(where, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.beforeBulkDestroy(function(where, fn) {
                fn()
              })

              this.User.beforeBulkDestroy(function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.afterBulkDestroy(function(where, fn) {
                fn()
              })

              this.User.afterBulkDestroy(function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })
      })

      describe('hook() method', function() {
        describe('with a single hook', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkDestroy', function(where, fn) {
                  beforeBulk = true
                  fn(null, where)
                })

                this.User.hook('afterBulkDestroy', function(where, fn) {
                  afterBulk = true
                  fn(null, where)
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkDestroy', function(where, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.hook('afterBulkDestroy', function(where, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkDestroy', function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkDestroy', function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })

        describe('with multiple hooks', function() {
          describe('on success', function() {
            describe('while returning the values', function() {
              it('should return with the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkDestroy', function(where, fn) {
                  beforeBulk = 'hi'
                  fn(null, where)
                })

                this.User.hook('beforeBulkDestroy', function(where, fn) {
                  beforeBulk = true
                  fn(null, where)
                })

                this.User.hook('afterBulkDestroy', function(where, fn) {
                  afterBulk = true
                  fn(null, where)
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })

            describe('without returning the values', function() {
              it('should return without the values', function(done) {
                var self = this
                  , beforeBulk = false
                  , afterBulk  = false

                this.User.hook('beforeBulkDestroy', function(where, fn) {
                  beforeBulk = 'hi'
                  fn()
                })


                this.User.hook('beforeBulkDestroy', function(where, fn) {
                  beforeBulk = true
                  fn()
                })

                this.User.hook('afterBulkDestroy', function(where, fn) {
                  afterBulk = true
                  fn()
                })

                this.User.destroy({username: 'Cheech', mood: 'sad'}).success(function() {
                  expect(beforeBulk).to.be.true
                  expect(afterBulk).to.be.true
                  done()
                })
              })
            })
          })

          describe('on error', function() {
            it('should return an error from before', function(done) {
              this.User.hook('beforeBulkDestroy', function(where, fn) {
                fn()
              })

              this.User.hook('beforeBulkDestroy', function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })

            it('should return an error from after', function(done) {
              this.User.hook('afterBulkDestroy', function(where, fn) {
                fn()
              })

              this.User.hook('afterBulkDestroy', function(where, fn) {
                fn('Whoops!')
              })

              this.User.destroy({username: 'Cheech', mood: 'sad'}).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })
      })
    })

    describe('with the {hooks: true} option', function() {
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
        })

        this.User.sync({ force: true }).success(function() {
          done()
        })
      })

      it('should run the after/before functions for each item created successfully', function(done) {
        var self       = this
          , beforeBulk = false
          , afterBulk  = false
          , beforeHook = false
          , afterHook  = false

        this.User.beforeBulkDestroy(function(where, fn) {
          beforeBulk = true
          fn()
        })

        this.User.afterBulkDestroy(function(where, fn) {
          afterBulk = true
          fn()
        })

        this.User.beforeDestroy(function(user, fn) {
          beforeHook = true
          fn()
        })

        this.User.afterDestroy(function(user, fn) {
          afterHook = true
          fn()
        })


        this.User.bulkCreate([
          {aNumber: 1}, {aNumber: 1}, {aNumber: 1}
        ]).success(function() {
          self.User.destroy({aNumber: 1}, {hooks: true}).success(function() {
            expect(beforeBulk).to.be.true
            expect(afterBulk).to.be.true
            expect(beforeHook).to.be.true
            expect(afterHook).to.be.true
            done()
          })
        })
      })

      it('should run the after/before functions for each item created with an error', function(done) {
        var self       = this
          , beforeBulk = false
          , afterBulk  = false
          , beforeHook = false
          , afterHook  = false

        this.User.beforeBulkDestroy(function(where, fn) {
          beforeBulk = true
          fn()
        })

        this.User.afterBulkDestroy(function(where, fn) {
          afterBulk = true
          fn()
        })

        this.User.beforeDestroy(function(user, fn) {
          beforeHook = true
          fn('You shall not pass!')
        })

        this.User.afterDestroy(function(user, fn) {
          afterHook = true
          fn()
        })

        this.User.bulkCreate([{aNumber: 1}, {aNumber: 1}, {aNumber: 1}], { fields: ['aNumber'] }).success(function() {
          self.User.destroy({aNumber: 1}, {hooks: true}).error(function(err) {
            expect(err).to.equal('You shall not pass!')
            expect(beforeBulk).to.be.true
            expect(beforeHook).to.be.true
            expect(afterBulk).to.be.false
            expect(afterHook).to.be.false
            done()
          })
        })
      })
    })
  })

  describe('aliases', function() {
    describe('direct method', function() {
      describe('#delete', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING
          })

          this.User.sync({ force: true }).success(function() {
            done()
          })
        })

        it('on success', function(done) {
          this.User.beforeDelete(function(user, fn) {
            beforeHook = true
            fn()
          })

          this.User.afterDelete(function(user, fn) {
            afterHook = true
            fn()
          })

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().success(function() {
              expect(beforeHook).to.be.true
              expect(afterHook).to.be.true
              done()
            })
          })
        })

        it('on error', function(done) {
          this.User.beforeDelete(function(user, fn) {
            beforeHook = true
            fn()
          })

          this.User.afterDelete(function(user, fn) {
            afterHook = true
            fn('Whoops!')
          })

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().error(function(err) {
              expect(beforeHook).to.be.true
              expect(afterHook).to.be.true
              expect(err).to.equal('Whoops!')
              done()
            })
          })
        })
      })
    })

    describe('.hook() method', function() {
      describe('#delete', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING
          })

          this.User.sync({ force: true }).success(function() {
            done()
          })
        })

        it('on success', function(done) {
          this.User.hook('beforeDelete', function(user, fn) {
            beforeHook = true
            fn()
          })

          this.User.hook('afterDelete', function(user, fn) {
            afterHook = true
            fn()
          })

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().success(function() {
              expect(beforeHook).to.be.true
              expect(afterHook).to.be.true
              done()
            })
          })
        })

        it('on error', function(done) {
          this.User.hook('beforeDelete', function(user, fn) {
            beforeHook = true
            fn()
          })

          this.User.hook('afterDelete', function(user, fn) {
            afterHook = true
            fn('Whoops!')
          })

          this.User.create({username: 'Toni'}).success(function(user) {
            user.destroy().error(function(err) {
              expect(beforeHook).to.be.true
              expect(afterHook).to.be.true
              expect(err).to.equal('Whoops!')
              done()
            })
          })
        })
      })
    })
  })

  describe('associations', function() {
    describe('1:1', function() {
      describe('cascade onUpdate', function() {
        beforeEach(function(done) {
          var self = this

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasOne(this.Tasks, {onUpdate: 'cascade', hooks: true})
          this.Tasks.belongsTo(this.Projects)

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        it('on success', function(done) {
          var self = this
            , beforeHook = false
            , afterHook  = false

          this.Tasks.beforeUpdate(function(task, fn) {
            beforeHook = true
            fn()
          })

          this.Tasks.afterUpdate(function(task, fn) {
            afterHook = true
            fn()
          })

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).success(function() {
                project.updateAttributes({id: 2}).success(function() {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        it('on error', function(done) {
          var self = this
            , beforeHook = false
            , afterHook  = false

          this.Tasks.afterUpdate(function(task, fn) {
            fn('Whoops!')
          })

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })
      })

      describe('cascade onDelete', function() {
        beforeEach(function(done) {
          var self = this
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasOne(this.Tasks, {onDelete: 'cascade', hooks: true})
          this.Tasks.belongsTo(this.Projects)

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        describe('#remove', function() {
          it('with no errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeDestroy(function(task, fn) {
              beforeTask = true
              fn()
            })

            this.Tasks.afterDestroy(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.setTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.true
                    expect(afterTask).to.be.true
                    done()
                  })
                })
              })
            })
          })

          it('with errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeDestroy(function(task, fn) {
              beforeTask = true
              fn('Whoops!')
            })

            this.Tasks.afterDestroy(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.setTask(task).success(function() {
                  project.destroy().error(function(err) {
                    expect(err).to.equal('Whoops!')
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.true
                    expect(afterTask).to.be.false
                    done()
                  })
                })
              })
            })
          })
        })
      })

      describe('no cascade update', function() {
        beforeEach(function(done) {
          var self = this

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasOne(this.Tasks)
          this.Tasks.belongsTo(this.Projects)

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        it('on success', function(done) {
          var self = this
            , beforeHook = false
            , afterHook  = false

          this.Tasks.beforeUpdate(function(task, fn) {
            beforeHook = true
            fn()
          })

          this.Tasks.afterUpdate(function(task, fn) {
            afterHook = true
            fn()
          })

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).success(function() {
                project.updateAttributes({id: 2}).success(function() {
                  expect(beforeHook).to.be.true
                  expect(afterHook).to.be.true
                  done()
                })
              })
            })
          })
        })

        it('on error', function(done) {
          var self = this
            , beforeHook = false
            , afterHook  = false

          this.Tasks.afterUpdate(function(task, fn) {
            fn('Whoops!')
          })

          this.Projects.create({title: 'New Project'}).success(function(project) {
            self.Tasks.create({title: 'New Task'}).success(function(task) {
              project.setTask(task).error(function(err) {
                expect(err).to.equal('Whoops!')
                done()
              })
            })
          })
        })
      })

      describe('no cascade delete', function() {
        beforeEach(function(done) {
          var self = this

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasMany(this.Tasks)
          this.Tasks.belongsTo(this.Projects)

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        describe('#remove', function() {
          it('with no errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeUpdate(function(task, fn) {
              beforeTask = true
              fn()
            })

            this.Tasks.afterUpdate(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.removeTask(task).success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.true
                    expect(afterTask).to.be.true
                    done()
                  })
                })
              })
            })
          })

          it('with errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeUpdate(function(task, fn) {
              beforeTask = true
              fn('Whoops!')
            })

            this.Tasks.afterUpdate(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeProject).to.be.true
                  expect(afterProject).to.be.true
                  expect(beforeTask).to.be.true
                  expect(afterTask).to.be.false
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('1:M', function() {
      describe('cascade', function() {
        beforeEach(function(done) {
          var self = this
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true})
          this.Tasks.belongsTo(this.Projects, {hooks: true})

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        describe('#remove', function() {
          it('with no errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeDestroy(function(task, fn) {
              beforeTask = true
              fn()
            })

            this.Tasks.afterDestroy(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.true
                    expect(afterTask).to.be.true
                    done()
                  })
                })
              })
            })
          })

          it('with errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeDestroy(function(task, fn) {
              beforeTask = true
              fn('Whoops!')
            })

            this.Tasks.afterDestroy(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().error(function(err) {
                    expect(err).to.equal('Whoops!')
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.true
                    expect(afterTask).to.be.false
                    done()
                  })
                })
              })
            })
          })
        })
      })

      describe('no cascade', function() {
        beforeEach(function(done) {
          var self = this

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasMany(this.Tasks)
          this.Tasks.belongsTo(this.Projects)

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        describe('#remove', function() {
          it('with no errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeUpdate(function(task, fn) {
              beforeTask = true
              fn()
            })

            this.Tasks.afterUpdate(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.removeTask(task).success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.true
                    expect(afterTask).to.be.true
                    done()
                  })
                })
              })
            })
          })

          it('with errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeUpdate(function(task, fn) {
              beforeTask = true
              fn('Whoops!')
            })

            this.Tasks.afterUpdate(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).error(function(err) {
                  expect(err).to.equal('Whoops!')
                  expect(beforeProject).to.be.true
                  expect(afterProject).to.be.true
                  expect(beforeTask).to.be.true
                  expect(afterTask).to.be.false
                  done()
                })
              })
            })
          })
        })
      })
    })

    describe('M:M', function() {
      describe('cascade', function() {
        beforeEach(function(done) {
          var self = this
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasMany(this.Tasks, {cascade: 'onDelete', joinTableName: 'projects_and_tasks', hooks: true})
          this.Tasks.hasMany(this.Projects, {cascade: 'onDelete', joinTableName: 'projects_and_tasks', hooks: true})

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        describe('#remove', function() {
          it('with no errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeDestroy(function(task, fn) {
              beforeTask = true
              fn()
            })

            this.Tasks.afterDestroy(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    // Since Sequelize does not cascade M:M, these should be false
                    expect(beforeTask).to.be.false
                    expect(afterTask).to.be.false
                    done()
                  })
                })
              })
            })
          })

          it('with errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeDestroy(function(task, fn) {
              beforeTask = true
              fn('Whoops!')
            })

            this.Tasks.afterDestroy(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.destroy().success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.false
                    expect(afterTask).to.be.false
                    done()
                  })
                })
              })
            })
          })
        })
      })

      describe('no cascade', function() {
        beforeEach(function(done) {
          var self = this

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          })

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          })

          this.Projects.hasMany(this.Tasks, {hooks: true})
          this.Tasks.hasMany(this.Projects, {hooks: true})

          this.Projects.sync({ force: true }).success(function() {
            self.Tasks.sync({ force: true }).success(function() {
              done()
            })
          })
        })

        describe('#remove', function() {
          it('with no errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeUpdate(function(task, fn) {
              beforeTask = true
              fn()
            })

            this.Tasks.afterUpdate(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  project.removeTask(task).success(function() {
                    expect(beforeProject).to.be.true
                    expect(afterProject).to.be.true
                    expect(beforeTask).to.be.false
                    expect(afterTask).to.be.false
                    done()
                  })
                })
              })
            })
          })

          it('with errors', function(done) {
            var self = this
              , beforeProject = false
              , afterProject  = false
              , beforeTask    = false
              , afterTask     = false

            this.Projects.beforeCreate(function(project, fn) {
              beforeProject = true
              fn()
            })

            this.Projects.afterCreate(function(project, fn) {
              afterProject = true
              fn()
            })

            this.Tasks.beforeUpdate(function(task, fn) {
              beforeTask = true
              fn('Whoops!')
            })

            this.Tasks.afterUpdate(function(task, fn) {
              afterTask = true
              fn()
            })

            this.Projects.create({title: 'New Project'}).success(function(project) {
              self.Tasks.create({title: 'New Task'}).success(function(task) {
                project.addTask(task).success(function() {
                  expect(beforeProject).to.be.true
                  expect(afterProject).to.be.true
                  expect(beforeTask).to.be.false
                  expect(afterTask).to.be.false
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
