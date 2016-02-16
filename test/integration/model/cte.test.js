'use strict';

var chai = require('chai')
  , expect = chai.expect
  , things = require('chai-things')
  , Promise = require('bluebird')
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current = Support.sequelize;

  chai.use(things);



describe(Support.getTestDialectTeaser('CTEs'), function () {
  if (current.dialect.supports.cteQueries) {
    describe('with findAll', function () {
      it('can follow a basic \'has one\' association', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasOne(User, { foreignKey: 'manager_id', as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return user3.setReport(user1).then(function () {
                  return User.findAll({
                    cte: [{
                      name: 'a',
                      model: User,
                      initial: { where: { username: 'user3' } },
                      recursive: { next: 'report' }
                    }],
                    cteSelect: 'a'
                  }).then(function (selectedUsers) {
                    expect(selectedUsers).to.have.length(2);
                    expect(selectedUsers[0]).to.have.property('username', 'user3');
                    expect(selectedUsers[1]).to.have.property('username', 'user1');
                  });
                });
              });
            });
          });
        });
      });

      it('can follow a basic \'belongs to\' association', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.belongsTo(User, { foreignKey: 'manager_id', as: 'boss' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return user3.setBoss(user1).then(function () {
                  return User.findAll({
                    cte: [{
                      name: 'a',
                      model: User,
                      initial: { where: { username: 'user3' } },
                      recursive: { next: 'boss' }
                    }],
                    cteSelect: 'a'
                  }).then(function (selectedUsers) {
                    expect(selectedUsers).to.have.length(2);
                    expect(selectedUsers[0]).to.have.property('username', 'user3');
                    expect(selectedUsers[1]).to.have.property('username', 'user1');
                  });
                });
              });
            });
          });
        });
      });

      it('can follow a \'has many\' association', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasMany(User, { foreignKey: 'manager_id', as: 'reports' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return user2.setReports([user3, user1]).then(function () {
                  return User.findAll({
                    cte: [{
                      name: 'a',
                      model: User,
                      initial: { where: { username: 'user2' } },
                      recursive: { next: 'reports' }
                    }],
                    cteSelect: 'a'
                  }).then(function (selectedUsers) {
                    expect(selectedUsers).to.have.length(3);
                    expect(selectedUsers[0]).to.have.property('username', 'user2');
                    expect(selectedUsers).to.contain.a.thing.with.property('username', 'user3');
                    expect(selectedUsers).to.contain.a.thing.with.property('username', 'user1');
                  });
                });
              });
            });
          });
        });
      });

      it('can follow a \'has many\' association2', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasMany(User, { foreignKey: 'manager_id', as: 'reports' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return user2.setReports([user3, user1]).then(function () {
                  return User.findAll({
                    cte: [{
                      name: 'a',
                      cteAttributes: ['depth'],
                      model: User,
                      initial: { depth: 0, where: { username: 'user2' } },
                      recursive: {
                        depth: {
                          $add: [{ $cte: 'depth' }, 1]
                        },
                        next: 'reports',
                        where: {
                          cte: {
                            depth: { $lt: 4 }
                          }
                        }
                      }
                    }],
                    cteSelect: 'a',
                    cteAttributes: ['depth']
                  }).then(function (selectedUsers) {
                    expect(selectedUsers).to.have.length(3);
                    expect(selectedUsers[0]).to.have.property('username', 'user2');
                    expect(selectedUsers).to.contain.a.thing.with.property('username', 'user3');
                    expect(selectedUsers).to.contain.a.thing.with.property('username', 'user1');
                  });
                });
              });
            });
          });
        });
      });

      it('can follow a \'belongs to many\' association', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.belongsToMany(User, { as: 'friends', through: 'friend_users' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return User.create({ username: 'user4' }).then(function (user4) {
                  return User.create({ username: 'user5' }).then(function (user5) {
                    return User.create({ username: 'user6' }).then(function (user6) {
                      return user1.addFriends([user4, user5]).then(function () {
                        return user2.addFriends([user3, user4]).then(function () {
                          return User.findAll({
                            cte: [{
                              name: 'a',
                              model: User,
                              cteAttributes: ['distance'],
                              initial: { where: { username: 'user1' }, distance: 0 },
                              recursive: {
                                next: 'friends',
                                distance: { $add: [{ $cte: 'distance' }, 1] },
                                where: { cte: { distance: { $lt: 1 } } },
                                order: [['distance', 'ASC']]
                              }
                            }],
                            cteSelect: 'a'
                          }).then(function (selectedUsers) {
                            expect(selectedUsers).to.have.length(3);
                            expect(selectedUsers).to.contain.a.thing.with.property('username', 'user1');
                            expect(selectedUsers).to.contain.a.thing.with.property('username', 'user4');
                            expect(selectedUsers).to.contain.a.thing.with.property('username', 'user5');
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

      it('can use scopes', function () {
        var User = this.sequelize.define('UserXYZ',
          { username: DataTypes.STRING }, {
            defaultScope: {},
            scopes: {
              cte: {
                cte: [{
                  name: 'a',
                  initial: { where: { username: 'user2' } },
                  recursive: { next: 'report' }
                }],
                cteSelect: 'a'
              }
            }
          });

        User.hasOne(User, { as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return user1.setReport(user2).then(function () {
                  return user2.setReport(user3).then(function () {
                    return User.scope('cte').findAll().then(function (selectedUsers) {
                      expect(selectedUsers).to.have.length(2);
                      expect(selectedUsers[0]).to.have.property('username', 'user2');
                      expect(selectedUsers[1]).to.have.property('username', 'user3');
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('can use function scopes', function () {
        var User = this.sequelize.define('UserXYZ',
          { username: DataTypes.STRING }, {
            defaultScope: {},
            scopes: {
              cte: function (username) {
                return {
                  cte: [{
                    name: 'a',
                    initial: { where: { username: username } },
                    recursive: { next: 'report' }
                  }],
                  cteSelect: 'a'
                };
              }
            }
          });

        User.hasOne(User, { as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return user1.setReport(user2).then(function () {
                  return user2.setReport(user3).then(function () {
                    return User.scope({ method: ['cte', 'user2'] }).findAll().then(function (selectedUsers) {
                      expect(selectedUsers).to.have.length(2);
                      expect(selectedUsers[0]).to.have.property('username', 'user2');
                      expect(selectedUsers[1]).to.have.property('username', 'user3');
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('can use include in an initial statement to limit intial selection', function () {
        var User = this.sequelize.define('UserXYZ', { user_id: { type: DataTypes.INTEGER, primaryKey: true }, username: DataTypes.STRING });

        User.hasOne(User, { as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ user_id: 1, username: 'user1' }).then(function (user1) {
            return User.create({ user_id: 10, username: 'user10' }).then(function (user2) {
              return User.create({ user_id: 100, username: 'user100' }).then(function (user3) {
                return user1.setReport(user2).then(function () {
                  return user2.setReport(user3).then(function() {
                    return User.findAll({
                      cte: [{
                      name: 'a',
                      model: User,
                      initial: { include: [{
                      model: User,
                      as: 'report',
                      where: { user_id: { $gt: 99 }}
                      }]},
                      recursive: { next: 'report'}
                      }],
                      cteSelect: 'a'
                    }).then(function (selectedUsers) {
                      expect(selectedUsers).to.have.length(2);
                      expect(selectedUsers[0]).to.have.property('username', 'user10');
                      expect(selectedUsers[1]).to.have.property('username', 'user100');
                    });
                  });
                });
              });
            });
          });
        });
      });

      it('can use include in an recursive statement to limit intial selection', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });
        var PicStore = this.sequelize.define('PicStore', { amount: DataTypes.INTEGER });

        PicStore.belongsToMany(User, { as: 'user', through: 'common_picstores' });
        User.belongsToMany(PicStore, { as: 'picStore', through: 'common_picstores' });
        User.belongsToMany(User, { as: 'friends', through: 'friend_users' });

        return this.sequelize.sync({ force: true }).then(function () {
          return Promise.join(
            User.create({ username: 'user1' }),
            User.create({ username: 'user1.1' }),
            User.create({ username: 'user1.2' }),
            User.create({ username: 'user1.3' }),
            User.create({ username: 'user1.1.1' }),
            User.create({ username: 'user1.3.1' }),
            User.create({ username: 'user1.3.2' }),
            PicStore.create({ amount: 30 }),
            PicStore.create({ amount: 600 }),
            function (user1, user2, user3, user4, user5, user6, user7, picstore1, picstore2) {
              return Promise.join(
                user1.setPicStore(picstore2),
                user2.setPicStore(picstore2),
                user3.setPicStore(picstore1),
                user4.setPicStore(picstore2),
                user5.setPicStore(picstore1),
                user6.setPicStore(picstore2),
                user7.setPicStore(picstore1),
                user1.addFriends([user2, user3, user4]),
                user2.addFriends([user5]),
                user4.addFriends([user6, user7]),
                function () { }
                );
            });
        }).then(function () {
          return User.findAll({
            cte: [{
              name: 'a',
              model: User,
              initial: {
                where: { username: 'user1' }
              },
              recursive: {
                next: 'friends',
                include: [{
                  useBefore: false,
                  model: PicStore,
                  as: 'picStore',
                  where: {
                    amount: { $gt: 30 }
                  }
                }]
              }
            }],
            cteSelect: 'a'
          })
        }).then(function (selectedUsers) {

          expect(selectedUsers).to.have.length(4);

          expect(selectedUsers[0].get('username')).to.equal('user1');
          expect(selectedUsers[1].get('username')).to.equal('user1.1');
          expect(selectedUsers[2].get('username')).to.equal('user1.3');
          expect(selectedUsers[3].get('username')).to.equal('user1.3.1');
        });
      });



      it('can use an attribute on a cte to end a query', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasOne(User, { foreignKey: 'manager_id', as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return User.create({ username: 'user4' }).then(function (user4) {
                  return User.create({ username: 'user5' }).then(function (user5) {
                    return user1.setReport(user2).then(function () {
                      return user2.setReport(user3).then(function () {
                        return user3.setReport(user4).then(function () {
                          return user4.setReport(user5).then(function () {
                            return User.findAll({
                              cte: [{
                                name: 'a',
                                model: User,
                                cteAttributes: ['count'],
                                initial: {
                                  where: { username: 'user1' },
                                  count: 1
                                },
                                recursive: {
                                  next: 'report',
                                  count: { $add: [{ $cte: 'count' }, 1] },
                                  where: { cte: { count: { $lt: 3 } } }
                                }
                              }],
                              cteSelect: 'a'
                            }).then(function (selectedUsers) {
                              expect(selectedUsers).to.have.length(3);
                              expect(selectedUsers[0]).to.have.property('username', 'user1');
                              expect(selectedUsers[1]).to.have.property('username', 'user2');
                              expect(selectedUsers[2]).to.have.property('username', 'user3');
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

      it('limit option will stop query at correct limit', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasOne(User, { foreignKey: 'manager_id', as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return User.create({ username: 'user4' }).then(function (user4) {
                  return User.create({ username: 'user5' }).then(function (user5) {
                    return user1.setReport(user2).then(function () {
                      return user2.setReport(user3).then(function () {
                        return user3.setReport(user4).then(function () {
                          return user4.setReport(user5).then(function () {
                            return user5.setReport(user1).then(function () {
                              return User.findAll({
                                cte: [{
                                  name: 'a',
                                  model: User,
                                  initial: {
                                    where: { username: 'user1' }
                                  },
                                  recursive: {
                                    next: 'report'
                                  },
                                  limit: 50,
                                  unique: false
                                }],
                                cteSelect: 'a'
                              }).then(function (selectedUsers) {
                                expect(selectedUsers).to.have.length(50);
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
      });

      it('limit and offset option select the correct users', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasOne(User, { foreignKey: 'manager_id', as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user2' }).then(function (user2) {
              return User.create({ username: 'user3' }).then(function (user3) {
                return User.create({ username: 'user4' }).then(function (user4) {
                  return User.create({ username: 'user5' }).then(function (user5) {
                    return user1.setReport(user2).then(function () {
                      return user2.setReport(user3).then(function () {
                        return user3.setReport(user4).then(function () {
                          return user4.setReport(user5).then(function () {
                            return User.findAll({
                              cte: [{
                                name: 'a',
                                model: User,
                                initial: {
                                  where: { username: 'user1' }
                                },
                                recursive: {
                                  next: 'report'
                                },
                                limit: 2,
                                offset: 2,
                                unique: false
                              }],
                              cteSelect: 'a'
                            }).then(function (selectedUsers) {
                              expect(selectedUsers).to.have.length(2);
                              expect(selectedUsers[0]).to.have.property('username', 'user3');
                              expect(selectedUsers[1]).to.have.property('username', 'user4');
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

      it('order by clause in cte', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasMany(User, { foreignKey: 'manager_id', as: 'reports' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user1.1' }).then(function (user2) {
              return User.create({ username: 'user1.2' }).then(function (user3) {
                return User.create({ username: 'user1.1.1' }).then(function (user4) {
                  return User.create({ username: 'user1.1.2' }).then(function (user5) {
                    return User.create({ username: 'user1.2.1' }).then(function (user6) {
                      return user1.setReports([user2, user3]).then(function () {
                        return user2.setReports([user4, user5]).then(function () {
                          return user3.setReports([user6]).then(function () {
                            return User.findAll({
                              cte: [{
                                name: 'a',
                                model: User,
                                cteAttributes: ['level'],
                                initial: {
                                  level: 1,
                                  where: { username: 'user1' }
                                },
                                recursive: {
                                  level: { $add: [{ $cte: 'level' }, 1] },
                                  next: 'reports',
                                },
                                order: [['level', 'DESC']]
                              }],
                              cteSelect: 'a'
                            }).then(function (selectedUsers) {
                              expect(selectedUsers).to.have.length(6);
                              expect(selectedUsers[0]).to.have.property('username', 'user1');
                              expect(selectedUsers[1]).to.have.property('username', 'user1.1');
                              expect(selectedUsers[2]).to.have.property('username', 'user1.1.1');
                              expect(selectedUsers[3]).to.have.property('username', 'user1.1.2');
                              expect(selectedUsers[4]).to.have.property('username', 'user1.2');
                              expect(selectedUsers[5]).to.have.property('username', 'user1.2.1');
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

      it('can return CTE attributes with a model', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasMany(User, { foreignKey: 'manager_id', as: 'reports' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user1.1' }).then(function (user2) {
              return User.create({ username: 'user1.2' }).then(function (user3) {
                return User.create({ username: 'user1.1.1' }).then(function (user4) {
                  return User.create({ username: 'user1.1.2' }).then(function (user5) {
                    return User.create({ username: 'user1.2.1' }).then(function (user6) {
                      return user1.setReports([user2, user3]).then(function () {
                        return user2.setReports([user4, user5]).then(function () {
                          return user3.setReports([user6]).then(function () {
                            return User.findAll({
                              cte: [{
                                name: 'a',
                                model: User,
                                cteAttributes: ['level'],
                                initial: {
                                  level: 1,
                                  where: { username: 'user1' }
                                },
                                recursive: {
                                  level: { $add: [{ $cte: 'level' }, 1] },
                                  next: 'reports',
                                  order: [['level', 'ASC']]
                                },
                              }],
                              includeCTEAttributes: ['level'],
                              cteSelect: 'a'
                            }).then(function (selectedUsers) {
                              expect(selectedUsers).to.have.length(6);

                              expect(selectedUsers[0].get('level')).to.equal(1);
                              expect(selectedUsers[1].get('level')).to.equal(2);
                              expect(selectedUsers[2].get('level')).to.equal(2);
                              expect(selectedUsers[3].get('level')).to.equal(3);
                              expect(selectedUsers[4].get('level')).to.equal(3);
                              expect(selectedUsers[5].get('level')).to.equal(3);
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


      it('can use CTE attributes in a recursive where', function () {
        var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });

        User.hasMany(User, { foreignKey: 'manager_id', as: 'reports' });

        return this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'user1' }).then(function (user1) {
            return User.create({ username: 'user1.1' }).then(function (user2) {
              return User.create({ username: 'user1.2' }).then(function (user3) {
                return User.create({ username: 'user1.1.1' }).then(function (user4) {
                  return User.create({ username: 'user1.1.2' }).then(function (user5) {
                    return User.create({ username: 'user1.2.1' }).then(function (user6) {
                      return user1.setReports([user2, user3]).then(function () {
                        return user2.setReports([user4, user5]).then(function () {
                          return user3.setReports([user6]).then(function () {
                            return User.findAll({
                              cte: [{
                                name: 'a',
                                model: User,
                                cteAttributes: ['level'],
                                initial: {
                                  level: 1,
                                  where: { username: 'user1' }
                                },
                                recursive: {
                                  level: { $add: [{ $cte: 'level' }, 1] },
                                  next: 'reports',
                                  order: [['level', 'DESC']],
                                  where: {
                                    cte: {
                                      level: {
                                        $lt: 2
                                      }
                                    }
                                  }
                                },
                              }],
                              cteSelect: 'a'
                            }).then(function (selectedUsers) {
                              expect(selectedUsers).to.have.length(3);
                              expect(selectedUsers[0]).to.have.property('username', 'user1');
                              expect(selectedUsers[1]).to.have.property('username', 'user1.1');
                              expect(selectedUsers[2]).to.have.property('username', 'user1.2');
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


      it('can use a counter based on a model attribute in a recursive CTE', function () {
        var User = this.sequelize.define('UserXYZ', {
          username: DataTypes.STRING,
          amount: DataTypes.INTEGER
        });

        User.hasOne(User, { as: 'report' });

        return this.sequelize.sync({ force: true }).then(function () {
          return Promise.join(
            User.create({ username: 'user1', amount: 12 }),
            User.create({ username: 'user2', amount: 5 }),
            User.create({ username: 'user3', amount: 2 }),
            User.create({ username: 'user4', amount: 23 }),
            User.create({ username: 'user5', amount: 13 }),
            User.create({ username: 'user6', amount: 7 }),
            function (user1, user2, user3, user4, user5, user6) {
              return Promise.join(
                user1.setReport(user2),
                user2.setReport(user3),
                user3.setReport(user4),
                user4.setReport(user5),
                user5.setReport(user6),
                function () { }
                );
            });
        }).then(function () {
          return User.findAll({
            cte: [{
              name: 'a',
              model: User,
              cteAttributes: ['totalAmount'],
              initial: {
                totalAmount: { $model: 'amount' },
                where: { username: 'user1' }
              },
              recursive: {
                totalAmount: {
                  $add: [{ $cte: 'totalAmount' },
                    { $model: 'amount' }]
                },
                next: 'report',
                order: [['level', 'DESC']],
                where: {
                  cte: {
                    totalAmount: {
                      $lt: 20
                    }
                  }
                }
              }
            }],
            cteSelect: 'a'
          }).then(function (selectedUsers) {
            expect(selectedUsers).to.have.length(4);
            expect(selectedUsers[0]).to.have.property('username', 'user1');
            expect(selectedUsers[1]).to.have.property('username', 'user2');
            expect(selectedUsers[2]).to.have.property('username', 'user3');
            expect(selectedUsers[3]).to.have.property('username', 'user4');
          });
        });
      });
    });
  }
});