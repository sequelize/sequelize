'use strict';

var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , datetime = require('chai-datetime')
  , async = require('async')
  , Promise = Sequelize.Promise;

chai.use(datetime);
chai.config.includeStack = true;

var sortById = function(a, b) {
  return a.id < b.id ? -1 : 1;
};

describe(Support.getTestDialectTeaser('Include'), function() {
  describe('findAll', function() {
    beforeEach(function() {
      this.fixtureA = function(done) {
        var User = this.sequelize.define('User', {})
          , Company = this.sequelize.define('Company', {
              name: DataTypes.STRING
            })
          , Product = this.sequelize.define('Product', {
              title: DataTypes.STRING
            })
          , Tag = this.sequelize.define('Tag', {
              name: DataTypes.STRING
            })
          , Price = this.sequelize.define('Price', {
              value: DataTypes.FLOAT
            })
          , Customer = this.sequelize.define('Customer', {
              name: DataTypes.STRING
          })
          , Group = this.sequelize.define('Group', {
              name: DataTypes.STRING
            })
          , GroupMember = this.sequelize.define('GroupMember', {

            })
          , Rank = this.sequelize.define('Rank', {
              name: DataTypes.STRING,
              canInvite: {
                type: DataTypes.INTEGER,
                defaultValue: 0
              },
              canRemove: {
                type: DataTypes.INTEGER,
                defaultValue: 0
              },
              canPost: {
                type: DataTypes.INTEGER,
                defaultValue: 0
              }
            });

        this.models = {
          User: User,
          Company: Company,
          Product: Product,
          Tag: Tag,
          Price: Price,
          Customer: Customer,
          Group: Group,
          GroupMember: GroupMember,
          Rank: Rank
        };

        User.hasMany(Product);
        Product.belongsTo(User);

        Product.hasMany(Tag);
        Tag.hasMany(Product);
        Product.belongsTo(Tag, {as: 'Category'});
        Product.belongsTo(Company);

        Product.hasMany(Price);
        Price.belongsTo(Product);

        User.hasMany(GroupMember, {as: 'Memberships'});
        GroupMember.belongsTo(User);
        GroupMember.belongsTo(Rank);
        GroupMember.belongsTo(Group);
        Group.hasMany(GroupMember, {as: 'Memberships'});

        this.sequelize.sync({force: true}).done(function() {
          var count = 4
            , i = -1;

          async.auto({
            groups: function(callback) {
              Group.bulkCreate([
                {name: 'Developers'},
                {name: 'Designers'},
                {name: 'Managers'}
              ]).done(function() {
                Group.findAll().done(callback);
              });
            },
            companies: function(callback) {
              Company.bulkCreate([
                {name: 'Sequelize'},
                {name: 'Coca Cola'},
                {name: 'Bonanza'},
                {name: 'NYSE'},
                {name: 'Coshopr'}
              ]).done(function(err) {
                if (err) return callback(err);
                Company.findAll().done(callback);
              });
            },
            ranks: function(callback) {
              Rank.bulkCreate([
                {name: 'Admin', canInvite: 1, canRemove: 1, canPost: 1},
                {name: 'Trustee', canInvite: 1, canRemove: 0, canPost: 1},
                {name: 'Member', canInvite: 1, canRemove: 0, canPost: 0}
              ]).done(function(err) {
                Rank.findAll().done(callback);
              });
            },
            tags: function(callback) {
              Tag.bulkCreate([
                {name: 'A'},
                {name: 'B'},
                {name: 'C'},
                {name: 'D'},
                {name: 'E'}
              ]).done(function() {
                Tag.findAll().done(callback);
              });
            },
            loop: ['groups', 'ranks', 'tags', 'companies', function(done, results) {
              var groups = results.groups
                , ranks = results.ranks
                , tags = results.tags
                , companies = results.companies;

              async.whilst(
                function() { return i < count; },
                function(callback) {
                  i++;
                  async.auto({
                    user: function(callback) {
                      User.create().done(callback);
                    },
                    memberships: ['user', function(callback, results) {
                      var groupMembers = [
                        {UserId: results.user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                        {UserId: results.user.id, GroupId: groups[1].id, RankId: ranks[2].id}
                      ];

                      if (i < 3) {
                        groupMembers.push({UserId: results.user.id, GroupId: groups[2].id, RankId: ranks[1].id});
                      }

                      GroupMember.bulkCreate(groupMembers).done(callback);
                    }],
                    products: function(callback) {
                      Product.bulkCreate([
                        {title: 'Chair'},
                        {title: 'Desk'},
                        {title: 'Bed'},
                        {title: 'Pen'},
                        {title: 'Monitor'}
                      ]).done(function(err) {
                        if (err) return callback(err);
                        Product.findAll().done(callback);
                      });
                    },
                    userProducts: ['user', 'products', function(callback, results) {
                      results.user.setProducts([
                        results.products[(i * 5) + 0],
                        results.products[(i * 5) + 1],
                        results.products[(i * 5) + 3]
                      ]).done(callback);
                    }],
                    productTags: ['products', function(callback, results) {
                      var chainer = new Sequelize.Utils.QueryChainer();

                      chainer.add(results.products[(i * 5) + 0].setTags([
                        tags[0],
                        tags[2]
                      ]));
                      chainer.add(results.products[(i * 5) + 1].setTags([
                        tags[1]
                      ]));
                      chainer.add(results.products[(i * 5) + 0].setCategory(tags[1]));

                      chainer.add(results.products[(i * 5) + 2].setTags([
                        tags[0]
                      ]));

                      chainer.add(results.products[(i * 5) + 3].setTags([
                        tags[0]
                      ]));

                      chainer.run().done(callback);
                    }],
                    companies: ['products', function(callback, results) {
                      var chainer = new Sequelize.Utils.QueryChainer();

                      results.products[(i * 5) + 0].setCompany(companies[4]);
                      results.products[(i * 5) + 1].setCompany(companies[3]);
                      results.products[(i * 5) + 2].setCompany(companies[2]);
                      results.products[(i * 5) + 3].setCompany(companies[1]);
                      results.products[(i * 5) + 4].setCompany(companies[0]);

                      chainer.run().done(callback);
                    }],
                    prices: ['products', function(callback, results) {
                      Price.bulkCreate([
                        {ProductId: results.products[(i * 5) + 0].id, value: 5},
                        {ProductId: results.products[(i * 5) + 0].id, value: 10},
                        {ProductId: results.products[(i * 5) + 1].id, value: 5},
                        {ProductId: results.products[(i * 5) + 1].id, value: 10},
                        {ProductId: results.products[(i * 5) + 1].id, value: 15},
                        {ProductId: results.products[(i * 5) + 1].id, value: 20},
                        {ProductId: results.products[(i * 5) + 2].id, value: 20},
                        {ProductId: results.products[(i * 5) + 3].id, value: 20}
                      ]).done(callback);
                    }]
                  }, callback);
                },
                function(err) {
                  expect(err).not.to.be.ok;
                  done();
                }
              );
            }]
          }, done.bind(this));
        });
      };
    });

    it('should work on a nested set of relations with a where condition in between relations', function() {
      var User = this.sequelize.define('User', {})
        , SubscriptionForm = this.sequelize.define('SubscriptionForm', {})
        , Collection = this.sequelize.define('Collection', {})
        , Category = this.sequelize.define('Category', {})
        , SubCategory = this.sequelize.define('SubCategory', {})
        , Capital = this.sequelize.define('Capital', {});

      User.hasOne(SubscriptionForm, {foreignKey: 'boundUser'});
      SubscriptionForm.belongsTo(User, {foreignKey: 'boundUser'});

      SubscriptionForm.hasOne(Collection, {foreignKey: 'boundDesigner'});
      Collection.belongsTo(SubscriptionForm, {foreignKey: 'boundDesigner'});

      SubscriptionForm.belongsTo(Category, {foreignKey: 'boundCategory'});
      Category.hasMany(SubscriptionForm, {foreignKey: 'boundCategory'});

      Capital.hasMany(Category, { foreignKey: 'boundCapital'});
      Category.belongsTo(Capital, {foreignKey: 'boundCapital'});

      Category.hasMany(SubCategory, {foreignKey: 'boundCategory'});
      SubCategory.belongsTo(Category, {foreignKey: 'boundCategory'});


      return this.sequelize.sync({force: true}).then(function() {
        return User.find({
          include: [
            {
              model: SubscriptionForm,
              include: [
                {
                  model: Collection,
                  where: {
                    id: 13
                  }
                },
                {
                  model: Category,
                  include: [
                    {
                      model: SubCategory
                    },
                    {
                      model: Capital,
                      include: [
                        {
                          model: Category
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        });
      });
    });

    it('should accept nested `where` and `limit` at the same time', function() {
      var Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , ProductTag = this.sequelize.define('ProductTag', {
            priority: DataTypes.INTEGER
        })
        , Set = this.sequelize.define('Set', {
            title: DataTypes.STRING
        });

      Set.hasMany(Product);
      Product.belongsTo(Set);
      Product.hasMany(Tag, {through: ProductTag});
      Tag.hasMany(Product, {through: ProductTag});

      return this.sequelize.sync({force: true}).then(function() {
        return Promise.join(
          Set.bulkCreate([
            {title: 'office'}
          ]),
          Product.bulkCreate([
            {title: 'Chair'},
            {title: 'Desk'},
            {title: 'Dress'}
          ]),
          Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ])
        ).then(function() {
          return Promise.join(
            Set.findAll(),
            Product.findAll(),
            Tag.findAll()
          );
        }).spread(function(sets, products, tags) {
          return Promise.join(
            sets[0].addProducts([products[0], products[1]]),
            products[0].addTag(tags[0], {priority: 1}).then(function() {
              return products[0].addTag(tags[1], {priority: 2});
            }).then(function() {
              return products[0].addTag(tags[2], {priority: 1});
            }),
            products[1].addTag(tags[1], {priority: 2}).then(function() {
              return products[2].addTag(tags[1], {priority: 3});
            }).then(function() {
              return products[2].addTag(tags[2], {priority: 0});
            })
          );
        }).then(function() {
          return Set.findAll({
            include: [{
              model: Product,
              include: [{
                model: Tag,
                where: {
                  name: 'A'
                }
              }]
            }],
            limit: 1
          });
        });
      });
    });

    it('should support an include with multiple different association types', function(done) {
      var User = this.sequelize.define('User', {})
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , Price = this.sequelize.define('Price', {
            value: DataTypes.FLOAT
          })
        , Customer = this.sequelize.define('Customer', {
            name: DataTypes.STRING
        })
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , GroupMember = this.sequelize.define('GroupMember', {

          })
        , Rank = this.sequelize.define('Rank', {
            name: DataTypes.STRING,
            canInvite: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            },
            canRemove: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            }
          });

      User.hasMany(Product);
      Product.belongsTo(User);

      Product.hasMany(Tag);
      Tag.hasMany(Product);
      Product.belongsTo(Tag, {as: 'Category'});

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, {as: 'Memberships'});
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, {as: 'Memberships'});

      this.sequelize.sync({force: true}).done(function() {
        var count = 4
          , i = -1;

        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          ranks: function(callback) {
            Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1},
              {name: 'Member', canInvite: 1, canRemove: 0}
            ]).done(function() {
              Rank.findAll().done(callback);
            });
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function() {
              Tag.findAll().done(callback);
            });
          },
          loop: ['groups', 'ranks', 'tags', function(done, results) {
            var groups = results.groups
              , ranks = results.ranks
              , tags = results.tags;

            async.whilst(
              function() { return i < count; },
              function(callback) {
                i++;

                async.auto({
                  user: function(callback) {
                    User.create().done(callback);
                  },
                  memberships: ['user', function(callback, results) {
                    GroupMember.bulkCreate([
                      {UserId: results.user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                      {UserId: results.user.id, GroupId: groups[1].id, RankId: ranks[1].id}
                    ]).done(callback);
                  }],
                  products: function(callback) {
                    Product.bulkCreate([
                      {title: 'Chair'},
                      {title: 'Desk'}
                    ]).done(function() {
                      Product.findAll().done(callback);
                    });
                  },
                  userProducts: ['user', 'products', function(callback, results) {
                    results.user.setProducts([
                      results.products[(i * 2) + 0],
                      results.products[(i * 2) + 1]
                    ]).done(callback);
                  }],
                  productTags: ['products', function(callback, results) {
                    var chainer = new Sequelize.Utils.QueryChainer();

                    chainer.add(results.products[(i * 2) + 0].setTags([
                      tags[0],
                      tags[2]
                    ]));
                    chainer.add(results.products[(i * 2) + 1].setTags([
                      tags[1]
                    ]));
                    chainer.add(results.products[(i * 2) + 0].setCategory(tags[1]));

                    chainer.run().done(callback);
                  }],
                  prices: ['products', function(callback, results) {
                    Price.bulkCreate([
                      {ProductId: results.products[(i * 2) + 0].id, value: 5},
                      {ProductId: results.products[(i * 2) + 0].id, value: 10},
                      {ProductId: results.products[(i * 2) + 1].id, value: 5},
                      {ProductId: results.products[(i * 2) + 1].id, value: 10},
                      {ProductId: results.products[(i * 2) + 1].id, value: 15},
                      {ProductId: results.products[(i * 2) + 1].id, value: 20}
                    ]).done(callback);
                  }]
                }, callback);
              },
              function(err) {
                expect(err).not.to.be.ok;

                User.findAll({
                  include: [
                    {model: GroupMember, as: 'Memberships', include: [
                      Group,
                      Rank
                    ]},
                    {model: Product, include: [
                      Tag,
                      {model: Tag, as: 'Category'},
                      Price
                    ]}
                  ],
                  order: [
                    ['id', 'ASC']
                  ]
                }).done(function(err, users) {
                  expect(err).not.to.be.ok;
                  users.forEach(function(user) {
                    user.Memberships.sort(sortById);

                    expect(user.Memberships.length).to.equal(2);
                    expect(user.Memberships[0].Group.name).to.equal('Developers');
                    expect(user.Memberships[0].Rank.canRemove).to.equal(1);
                    expect(user.Memberships[1].Group.name).to.equal('Designers');
                    expect(user.Memberships[1].Rank.canRemove).to.equal(0);

                    user.Products.sort(sortById);
                    expect(user.Products.length).to.equal(2);
                    expect(user.Products[0].Tags.length).to.equal(2);
                    expect(user.Products[1].Tags.length).to.equal(1);
                    expect(user.Products[0].Category).to.be.ok;
                    expect(user.Products[1].Category).not.to.be.ok;

                    expect(user.Products[0].Prices.length).to.equal(2);
                    expect(user.Products[1].Prices.length).to.equal(4);

                    done();
                  });
                });
              }
            );
          }]
        }, done);
      });
    });

    it('should support many levels of belongsTo', function(done) {
      var A = this.sequelize.define('a', {})
        , B = this.sequelize.define('b', {})
        , C = this.sequelize.define('c', {})
        , D = this.sequelize.define('d', {})
        , E = this.sequelize.define('e', {})
        , F = this.sequelize.define('f', {})
        , G = this.sequelize.define('g', {})
        , H = this.sequelize.define('h', {});

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      var b, singles = [
        B,
        C,
        D,
        E,
        F,
        G,
        H
      ];

      this.sequelize.sync().done(function() {
        async.auto({
          as: function(callback) {
            A.bulkCreate([
              {},
              {},
              {},
              {},
              {},
              {},
              {},
              {}
            ]).done(function() {
              A.findAll().done(callback);
            });
          },
          singleChain: function(callback) {
            var previousInstance;

            async.eachSeries(singles, function(model, callback) {
              model.create({}).done(function(err, instance) {
                if (previousInstance) {
                  previousInstance['set'+ Sequelize.Utils.uppercaseFirst(model.name)](instance).done(function() {
                    previousInstance = instance;
                    callback();
                  });
                } else {
                  previousInstance = b = instance;
                  callback();
                }
              });
            }, callback);
          },
          abs: ['as', 'singleChain', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            results.as.forEach(function(a) {
              chainer.add(a.setB(b));
            });

            chainer.run().done(callback);
          }]
        }, function() {

          A.findAll({
            include: [
              {model: B, include: [
                {model: C, include: [
                  {model: D, include: [
                    {model: E, include: [
                      {model: F, include: [
                        {model: G, include: [
                          {model: H}
                        ]}
                      ]}
                    ]}
                  ]}
                ]}
              ]}
            ]
          }).done(function(err, as) {
            expect(err).not.to.be.ok;
            expect(as.length).to.be.ok;

            as.forEach(function(a) {
              expect(a.b.c.d.e.f.g.h).to.be.ok;
            });
            done();
          });
        });
      });
    });

    it('should support many levels of belongsTo (with a lower level having a where)', function(done) {
      var A = this.sequelize.define('a', {})
        , B = this.sequelize.define('b', {})
        , C = this.sequelize.define('c', {})
        , D = this.sequelize.define('d', {})
        , E = this.sequelize.define('e', {})
        , F = this.sequelize.define('f', {})
        , G = this.sequelize.define('g', {
          name: DataTypes.STRING
        })
        , H = this.sequelize.define('h', {
          name: DataTypes.STRING
        });

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      var b, singles = [
        B,
        C,
        D,
        E,
        F,
        G,
        H
      ];

      this.sequelize.sync().done(function() {
        async.auto({
          as: function(callback) {
            A.bulkCreate([
              {},
              {},
              {},
              {},
              {},
              {},
              {},
              {}
            ]).done(function() {
              A.findAll().done(callback);
            });
          },
          singleChain: function(callback) {
            var previousInstance;

            async.eachSeries(singles, function(model, callback) {
              var values = {};

              if (model.name === 'g') {
                values.name = 'yolo';
              }
              model.create(values).done(function(err, instance) {
                if (previousInstance) {
                  previousInstance['set'+ Sequelize.Utils.uppercaseFirst(model.name)](instance).done(function() {
                    previousInstance = instance;
                    callback();
                  });
                } else {
                  previousInstance = b = instance;
                  callback();
                }
              });
            }, callback);
          },
          abs: ['as', 'singleChain', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            results.as.forEach(function(a) {
              chainer.add(a.setB(b));
            });

            chainer.run().done(callback);
          }]
        }, function() {

          A.findAll({
            include: [
              {model: B, include: [
                {model: C, include: [
                  {model: D, include: [
                    {model: E, include: [
                      {model: F, include: [
                        {model: G, where: {
                          name: 'yolo'
                        }, include: [
                          {model: H}
                        ]}
                      ]}
                    ]}
                  ]}
                ]}
              ]}
            ]
          }).done(function(err, as) {
            expect(err).not.to.be.ok;
            expect(as.length).to.be.ok;

            as.forEach(function(a) {
              expect(a.b.c.d.e.f.g.h).to.be.ok;
            });
            done();
          });
        });
      });
    });

    it('should support ordering with only belongsTo includes', function(done) {
      var User = this.sequelize.define('User', {})
        , Item = this.sequelize.define('Item', {'test': DataTypes.STRING})
        , Order = this.sequelize.define('Order', {'position': DataTypes.INTEGER});

      User.belongsTo(Item, {'as': 'itemA', foreignKey: 'itemA_id'});
      User.belongsTo(Item, {'as': 'itemB', foreignKey: 'itemB_id'});
      User.belongsTo(Order);

      this.sequelize.sync().done(function() {
        async.auto({
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          items: function(callback) {
            Item.bulkCreate([
              {'test': 'abc'},
              {'test': 'def'},
              {'test': 'ghi'},
              {'test': 'jkl'}
            ]).done(function() {
              Item.findAll({order: ['id']}).done(callback);
            });
          },
          orders: function(callback) {
            Order.bulkCreate([
              {'position': 2},
              {'position': 3},
              {'position': 1}
            ]).done(function() {
              Order.findAll({order: ['id']}).done(callback);
            });
          },
          associate: ['users', 'items', 'orders', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            var user1 = results.users[0];
            var user2 = results.users[1];
            var user3 = results.users[2];

            var item1 = results.items[0];
            var item2 = results.items[1];
            var item3 = results.items[2];
            var item4 = results.items[3];

            var order1 = results.orders[0];
            var order2 = results.orders[1];
            var order3 = results.orders[2];

            chainer.add(user1.setItemA(item1));
            chainer.add(user1.setItemB(item2));
            chainer.add(user1.setOrder(order3));

            chainer.add(user2.setItemA(item3));
            chainer.add(user2.setItemB(item4));
            chainer.add(user2.setOrder(order2));

            chainer.add(user3.setItemA(item1));
            chainer.add(user3.setItemB(item4));
            chainer.add(user3.setOrder(order1));

            chainer.run().done(callback);
          }]
        }, function() {
          User.findAll({
            'include': [
              {'model': Item, 'as': 'itemA', where: {test: 'abc'}},
              {'model': Item, 'as': 'itemB'},
              Order],
            'order': [
              [Order, 'position']
            ]
          }).done(function(err, as) {
            expect(err).not.to.be.ok;
            expect(as.length).to.eql(2);

            expect(as[0].itemA.test).to.eql('abc');
            expect(as[1].itemA.test).to.eql('abc');

            expect(as[0].Order.position).to.eql(1);
            expect(as[1].Order.position).to.eql(2);

            done();
          });
        });
      });
    });

    it('should include attributes from through models', function(done) {
      var Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , ProductTag = this.sequelize.define('ProductTag', {
            priority: DataTypes.INTEGER
        });

      Product.hasMany(Tag, {through: ProductTag});
      Tag.hasMany(Product, {through: ProductTag});

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          products: function(callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'},
              {title: 'Dress'}
            ]).done(function() {
              Product.findAll().done(callback);
            });
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function() {
              Tag.findAll().done(callback);
            });
          },
          productTags: ['products', 'tags', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            chainer.add(results.products[0].addTag(results.tags[0], {priority: 1}));
            chainer.add(results.products[0].addTag(results.tags[1], {priority: 2}));

            chainer.add(results.products[1].addTag(results.tags[1], {priority: 1}));

            chainer.add(results.products[2].addTag(results.tags[0], {priority: 3}));
            chainer.add(results.products[2].addTag(results.tags[1], {priority: 1}));
            chainer.add(results.products[2].addTag(results.tags[2], {priority: 2}));

            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          Product.findAll({
            include: [
              {model: Tag}
            ],
            order: [
              ['id', 'ASC'],
              [Tag, 'id', 'ASC']
            ]
          }).done(function(err, products) {
            expect(err).not.to.be.ok;

            expect(products[0].Tags[0].ProductTag.priority).to.equal(1);
            expect(products[0].Tags[1].ProductTag.priority).to.equal(2);

            expect(products[1].Tags[0].ProductTag.priority).to.equal(1);

            expect(products[2].Tags[0].ProductTag.priority).to.equal(3);
            expect(products[2].Tags[1].ProductTag.priority).to.equal(1);
            expect(products[2].Tags[2].ProductTag.priority).to.equal(2);

            done();
          });
        });
      });
    });

    it('should support a required belongsTo include', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      User.belongsTo(Group);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([{}, {}]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            results.users[2].setGroup(results.groups[1]).done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, required: true}
            ]
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(1);
            expect(users[0].Group).to.be.ok;
            done();
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          });

      User.belongsTo(Group);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'A'},
              {name: 'B'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[0].setGroup(results.groups[1]));
            chainer.add(results.users[1].setGroup(results.groups[0]));
            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, where: {name: 'A'}}
            ]
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(1);
            expect(users[0].Group).to.be.ok;
            expect(users[0].Group.name).to.equal('A');
            done();
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          });

      User.belongsTo(Group);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'A'},
              {name: 'B'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[0].setGroup(results.groups[1]));
            chainer.add(results.users[1].setGroup(results.groups[0]));
            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, required: true}
            ]
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            users.forEach(function(user) {
              expect(user.Group).to.be.ok;
            });
            done();
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany not required', function(done) {
      var S = this.sequelize
        , Address = S.define('Address', { 'active': DataTypes.BOOLEAN })
        , Street = S.define('Street', { 'active': DataTypes.BOOLEAN })
        , User = S.define('User', { 'username': DataTypes.STRING });

      // Associate
      User.belongsTo(Address, { foreignKey: 'addressId' });
      Address.hasMany(User, { foreignKey: 'addressId' });

      Address.belongsTo(Street, { foreignKey: 'streetId' });
      Street.hasMany(Address, { foreignKey: 'streetId' });

      // Sync
      S.sync({ force: true }).success(function() {

        // Create instances
        Street.create({ active: true }).done(function(err, street ) { expect(err).not.to.be.ok; expect(street).to.be.ok;
        Address.create({ active: true, streetId: street.id }).done(function(err, address ) { expect(err).not.to.be.ok; expect(address).to.be.ok;
        User.create({ username: 'John', addressId: address.id }).done(function(err, john ) { expect(err).not.to.be.ok; expect(john).to.be.ok;

            // Test
            User.find({
              where: { username: 'John'},
              include: [{
                model: Address,
                required: true,
                where: {
                  active: true
                },
                include: [{
                  model: Street
                }]
              }]
            }).done(function(err, john) {
              expect(err).not.to.be.ok;
              expect(john.Address).to.be.ok;
              expect(john.Address.Street).to.be.ok;
              done();
            });

        });
        });
        });

      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , Category = this.sequelize.define('Category', {
            category: DataTypes.STRING
          });

      User.belongsTo(Group);
      Group.hasMany(Category);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'A'},
              {name: 'B'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          categories: function(callback) {
            Category.bulkCreate([{}, {}]).done(function() {
              Category.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[0].setGroup(results.groups[1]));
            chainer.add(results.users[1].setGroup(results.groups[0]));
            chainer.run().done(callback);
          }],
          groupCategories: ['groups', 'categories', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            results.groups.forEach(function(group) {
              chainer.add(group.setCategories(results.categories));
            });

            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, required: true, include: [
                {model: Category}
              ]}
            ],
            limit: 1
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(1);
            users.forEach(function(user) {
              expect(user.Group).to.be.ok;
              expect(user.Group.Categories).to.be.ok;
            });
            done();
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit and aliases', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , Category = this.sequelize.define('Category', {
            category: DataTypes.STRING
          });

      User.belongsTo(Group, {as: 'Team'});
      Group.hasMany(Category, {as: 'Tags'});

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'A'},
              {name: 'B'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          categories: function(callback) {
            Category.bulkCreate([{}, {}]).done(function() {
              Category.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[0].setTeam(results.groups[1]));
            chainer.add(results.users[1].setTeam(results.groups[0]));
            chainer.run().done(callback);
          }],
          groupCategories: ['groups', 'categories', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            results.groups.forEach(function(group) {
              chainer.add(group.setTags(results.categories));
            });

            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, required: true, as: 'Team', include: [
                {model: Category, as: 'Tags'}
              ]}
            ],
            limit: 1
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(1);
            users.forEach(function(user) {
              expect(user.Team).to.be.ok;
              expect(user.Team.Tags).to.be.ok;
            });
            done();
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany which is not required with limit', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , Category = this.sequelize.define('Category', {
            category: DataTypes.STRING
          });

      User.belongsTo(Group);
      Group.hasMany(Category);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'A'},
              {name: 'B'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          categories: function(callback) {
            Category.bulkCreate([{}, {}]).done(function() {
              Category.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[0].setGroup(results.groups[1]));
            chainer.add(results.users[1].setGroup(results.groups[0]));
            chainer.run().done(callback);
          }],
          groupCategories: ['groups', 'categories', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            results.groups.forEach(function(group) {
              chainer.add(group.setCategories(results.categories));
            });

            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, required: true, include: [
                {model: Category, required: false}
              ]}
            ],
            limit: 1
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(1);
            users.forEach(function(user) {
              expect(user.Group).to.be.ok;
              expect(user.Group.Categories).to.be.ok;
            });
            done();
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a hasOne include', function(done) {
      var User = this.sequelize.define('User', {})
        , Project = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

      User.hasOne(Project, {as: 'LeaderOf'});

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          projects: function(callback) {
            Project.bulkCreate([
              {title: 'Alpha'},
              {title: 'Beta'}
            ]).done(function() {
              Project.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          userProjects: ['users', 'projects', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[1].setLeaderOf(results.projects[1]));
            chainer.add(results.users[0].setLeaderOf(results.projects[0]));
            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Project, as: 'LeaderOf', where: {title: 'Beta'}}
            ]
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(1);
            expect(users[0].LeaderOf).to.be.ok;
            expect(users[0].LeaderOf.title).to.equal('Beta');
            done();
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a hasMany include with a through model', function(done) {
      var Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , ProductTag = this.sequelize.define('ProductTag', {
            priority: DataTypes.INTEGER
        });

      Product.hasMany(Tag, {through: ProductTag});
      Tag.hasMany(Product, {through: ProductTag});

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          products: function(callback) {
            Product.bulkCreate([
              {title: 'Chair'},
              {title: 'Desk'},
              {title: 'Dress'}
            ]).done(function() {
              Product.findAll().done(callback);
            });
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function() {
              Tag.findAll().done(callback);
            });
          },
          productTags: ['products', 'tags', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();

            chainer.add(results.products[0].addTag(results.tags[0], {priority: 1}));
            chainer.add(results.products[0].addTag(results.tags[1], {priority: 2}));

            chainer.add(results.products[1].addTag(results.tags[1], {priority: 1}));

            chainer.add(results.products[2].addTag(results.tags[0], {priority: 3}));
            chainer.add(results.products[2].addTag(results.tags[1], {priority: 1}));
            chainer.add(results.products[2].addTag(results.tags[2], {priority: 2}));

            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          Product.findAll({
            include: [
              {model: Tag, where: {name: 'C'}}
            ]
          }).done(function(err, products) {
            expect(err).not.to.be.ok;

            expect(products.length).to.equal(1);
            expect(products[0].Tags.length).to.equal(1);

            done();
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on nested includes', function(done) {
      var User = this.sequelize.define('User', {
            name: DataTypes.STRING
          })
        , Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          })
        , Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          })
        , Price = this.sequelize.define('Price', {
            value: DataTypes.FLOAT
          })
        , Customer = this.sequelize.define('Customer', {
            name: DataTypes.STRING
        })
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          })
        , GroupMember = this.sequelize.define('GroupMember', {

          })
        , Rank = this.sequelize.define('Rank', {
            name: DataTypes.STRING,
            canInvite: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            },
            canRemove: {
              type: DataTypes.INTEGER,
              defaultValue: 0
            }
          });

      User.hasMany(Product);
      Product.belongsTo(User);

      Product.hasMany(Tag);
      Tag.hasMany(Product);
      Product.belongsTo(Tag, {as: 'Category'});

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, {as: 'Memberships'});
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, {as: 'Memberships'});

      this.sequelize.sync({force: true}).done(function() {
        var count = 4
          , i = -1;

        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          ranks: function(callback) {
            Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1},
              {name: 'Member', canInvite: 1, canRemove: 0}
            ]).done(function() {
              Rank.findAll().done(callback);
            });
          },
          tags: function(callback) {
            Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'}
            ]).done(function() {
              Tag.findAll().done(callback);
            });
          },
          loop: ['groups', 'ranks', 'tags', function(done, results) {
            var groups = results.groups
              , ranks = results.ranks
              , tags = results.tags;

            async.whilst(
              function() { return i < count; },
              function(callback) {
                i++;

                async.auto({
                  user: function(callback) {
                    User.create({name: 'FooBarzz'}).done(callback);
                  },
                  memberships: ['user', function(callback, results) {
                    GroupMember.bulkCreate([
                      {UserId: results.user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                      {UserId: results.user.id, GroupId: groups[1].id, RankId: ranks[1].id}
                    ]).done(callback);
                  }],
                  products: function(callback) {
                    Product.bulkCreate([
                      {title: 'Chair'},
                      {title: 'Desk'}
                    ]).done(function() {
                      Product.findAll().done(callback);
                    });
                  },
                  userProducts: ['user', 'products', function(callback, results) {
                    results.user.setProducts([
                      results.products[(i * 2) + 0],
                      results.products[(i * 2) + 1]
                    ]).done(callback);
                  }],
                  productTags: ['products', function(callback, results) {
                    var chainer = new Sequelize.Utils.QueryChainer();

                    chainer.add(results.products[(i * 2) + 0].setTags([
                      tags[0],
                      tags[2]
                    ]));
                    chainer.add(results.products[(i * 2) + 1].setTags([
                      tags[1]
                    ]));
                    chainer.add(results.products[(i * 2) + 0].setCategory(tags[1]));

                    chainer.run().done(callback);
                  }],
                  prices: ['products', function(callback, results) {
                    Price.bulkCreate([
                      {ProductId: results.products[(i * 2) + 0].id, value: 5},
                      {ProductId: results.products[(i * 2) + 0].id, value: 10},
                      {ProductId: results.products[(i * 2) + 1].id, value: 5},
                      {ProductId: results.products[(i * 2) + 1].id, value: 10},
                      {ProductId: results.products[(i * 2) + 1].id, value: 15},
                      {ProductId: results.products[(i * 2) + 1].id, value: 20}
                    ]).done(callback);
                  }]
                }, callback);
              },
              function(err) {
                expect(err).not.to.be.ok;

                User.findAll({
                  include: [
                    {model: GroupMember, as: 'Memberships', include: [
                      Group,
                      {model: Rank, where: {name: 'Admin'}}
                    ]},
                    {model: Product, include: [
                      Tag,
                      {model: Tag, as: 'Category'},
                      {model: Price, where: {
                        value: {
                          gt: 15
                        }
                      }}
                    ]}
                  ],
                  order: [
                    ['id', 'ASC']
                  ]
                }).done(function(err, users) {
                  expect(err).not.to.be.ok;

                  users.forEach(function(user) {
                    expect(user.Memberships.length).to.equal(1);
                    expect(user.Memberships[0].Rank.name).to.equal('Admin');
                    expect(user.Products.length).to.equal(1);
                    expect(user.Products[0].Prices.length).to.equal(1);
                  });

                  done();
                });
              }
            );
          }]
        }, done);
      });
    });

    it('should be possible to use limit and a where with a belongsTo include', function(done) {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          });

      User.belongsTo(Group);

      this.sequelize.sync({force: true}).done(function() {
        async.auto({
          groups: function(callback) {
            Group.bulkCreate([
              {name: 'A'},
              {name: 'B'}
            ]).done(function() {
              Group.findAll().done(callback);
            });
          },
          users: function(callback) {
            User.bulkCreate([{}, {}, {}, {}]).done(function() {
              User.findAll().done(callback);
            });
          },
          userGroups: ['users', 'groups', function(callback, results) {
            var chainer = new Sequelize.Utils.QueryChainer();
            chainer.add(results.users[0].setGroup(results.groups[0]));
            chainer.add(results.users[1].setGroup(results.groups[0]));
            chainer.add(results.users[2].setGroup(results.groups[0]));
            chainer.add(results.users[3].setGroup(results.groups[1]));
            chainer.run().done(callback);
          }]
        }, function(err) {
          expect(err).not.to.be.ok;

          User.findAll({
            include: [
              {model: Group, where: {name: 'A'}}
            ],
            limit: 2
          }).done(function(err, users) {
            expect(err).not.to.be.ok;
            expect(users.length).to.equal(2);

            users.forEach(function(user) {
              expect(user.Group.name).to.equal('A');
            });
            done();
          });
        });
      });
    });

    it('should be possible use limit, attributes and a where on a belongsTo with additional hasMany includes', function(done) {
      var self = this;
      this.fixtureA(function() {
        self.models.Product.findAll({
          attributes: ['id', 'title'],
          include: [
            {model: self.models.Company, where: {name: 'NYSE'}},
            {model: self.models.Tag},
            {model: self.models.Price}
          ],
          limit: 3,
          order: [
            [self.sequelize.col(self.models.Product.name + '.id'), 'ASC']
          ]
        }).done(function(err, products) {
          expect(err).not.to.be.ok;
          expect(products.length).to.equal(3);

          products.forEach(function(product) {
            expect(product.Company.name).to.equal('NYSE');
            expect(product.Tags.length).to.be.ok;
            expect(product.Prices.length).to.be.ok;
          });
          done();
        });
      });
    });

    it('should be possible to have the primary key in attributes', function() {
      var Parent = this.sequelize.define('Parent', {});
      var Child1 = this.sequelize.define('Child1', {});

      Parent.hasMany(Child1);
      Child1.belongsTo(Parent);

      return this.sequelize.sync({force: true}).then(function() {
        return Sequelize.Promise.all([
          Parent.create(),
          Child1.create()
        ]);
      }).spread(function(parent, child) {
        return parent.addChild1(child).then(function() {
          return parent;
        });
      }).then(function(parent) {
        return Child1.find({
          include: [
            {
              model: Parent,
              attributes: ['id'], // This causes a duplicated entry in the query
              where: {
                id: parent.id
              }
            }
          ]
        });
      });
    });

    it('should be possible to turn off the attributes for the through table', function(done) {
      var self = this;
      this.fixtureA(function() {
        self.models.Product.findAll({
          attributes: ['title'],
          include: [
            {model: self.models.Tag, through: {attributes: []}, required: true}
          ]
        }).done(function(err, products) {
          expect(err).not.to.be.ok;

          products.forEach(function(product) {
            expect(product.Tags.length).to.be.ok;
            product.Tags.forEach(function(tag) {
              expect(tag.get().productTags).not.to.be.ok;
            });
          });
          done();
        });
      });
    });


    it('should be possible to select on columns inside a through table', function(done) {
      var self = this;
      this.fixtureA(function() {
        self.models.Product.findAll({
          attributes: ['title'],
          include: [
            {
              model: self.models.Tag,
              through: {
                where: {
                  ProductId: 3
                }
              },
              required: true
            }
          ]
        }).done(function(err, products) {
          expect(err).not.to.be.ok;
          expect(products).have.length(1);

          done();
        });
      });
    });

    it('should be possible to select on columns inside a through table and a limit', function(done) {
      var self = this;
      this.fixtureA(function() {
        self.models.Product.findAll({
          attributes: ['title'],
          include: [
            {
              model: self.models.Tag,
              through: {
                where: {
                  ProductId: 3
                }
              },
              required: true
            }
          ],
          limit: 5
        }).done(function(err, products) {
          expect(err).not.to.be.ok;
          expect(products).have.length(1);

          done();
        });
      });
    });

    // Test case by @eshell
    it('should be possible not to include the main id in the attributes', function(done) {
      var Member = this.sequelize.define('Member', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false,
          validate: {
            isEmail: true,
            notNull: true,
            notEmpty: true
          }
        },
        password: Sequelize.STRING
      });
      var Album = this.sequelize.define('Album', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true
        },
        title: {
          type: Sequelize.STRING(25),
          allowNull: false
        }
      });

      Album.belongsTo(Member);
      Member.hasMany(Album);

      this.sequelize.sync({force: true}).done(function(err) {
        expect(err).not.to.be.ok;

        var members = []
          , albums = []
          , memberCount = 20;

        for (var i = 1; i <= memberCount; i++) {
          members.push({
            id: i,
            email: 'email' + i + '@lmu.com',
            password: 'testing' + i
          });
          albums.push({
            title: 'Album' + i,
            MemberId: i
          });
        }

        Member.bulkCreate(members).done(function(err) {
          expect(err).not.to.be.ok;
          Album.bulkCreate(albums).done(function(err) {
            expect(err).not.to.be.ok;

            Member.findAll({
              attributes: ['email'],
              include: [
                {
                  model: Album
                }
              ]
            }).done(function(err, members) {
              expect(err).not.to.be.ok;
              expect(members.length).to.equal(20);
              members.forEach(function(member) {
                expect(member.get('id')).not.to.be.ok;
                expect(member.Albums.length).to.equal(1);
              });

              done();
            });
          });
        });
      });
    });

    it('should be possible to use limit and a where on a hasMany with additional includes', function(done) {
      var self = this;
      this.fixtureA(function() {
        self.models.Product.findAll({

          include: [
            {model: self.models.Company},
            {model: self.models.Tag},
            {model: self.models.Price, where: {
              value: {gt: 5}
            }}
          ],
          limit: 6,
          order: [
            ['id', 'ASC']
          ]
        }).done(function(err, products) {
          expect(err).not.to.be.ok;
          expect(products.length).to.equal(6);

          products.forEach(function(product) {
            expect(product.Tags.length).to.be.ok;
            expect(product.Prices.length).to.be.ok;

            product.Prices.forEach(function(price) {
              expect(price.value).to.be.above(5);
            });
          });
          done();
        });
      });
    });

    it('should be possible to use limit and a where on a hasMany with a through model with additional includes', function(done) {
      var self = this;
      this.fixtureA(function() {
        self.models.Product.findAll({
          include: [
            {model: self.models.Company},
            {model: self.models.Tag, where: {name: ['A', 'B', 'C']}},
            {model: self.models.Price}
          ],
          limit: 10,
          order: [
            ['id', 'ASC']
          ]
        }).done(function(err, products) {
          expect(err).not.to.be.ok;
          expect(products.length).to.equal(10);

          products.forEach(function(product) {
            expect(product.Tags.length).to.be.ok;
            expect(product.Prices.length).to.be.ok;

            product.Tags.forEach(function(tag) {
              expect(['A', 'B', 'C']).to.include(tag.name);
            });
          });
          done();
        });
      });
    });

    it('should support including date fields, with the correct timeszone', function(done) {
      var User = this.sequelize.define('user', {
          dateField: Sequelize.DATE
        }, {timestamps: false})
        , Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, {timestamps: false});

      User.hasMany(Group);
      Group.hasMany(User);

      this.sequelize.sync().success(function() {
        User.create({ dateField: Date.UTC(2014, 1, 20) }).success(function(user) {
          Group.create({ dateField: Date.UTC(2014, 1, 20) }).success(function(group) {
            user.addGroup(group).success(function() {
              User.findAll({
                where: {
                  id: user.id
                },
                include: [Group]
              }).success(function(users) {
                expect(users[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
                expect(users[0].groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));

                done();
              });
            });
          });
        });
      });
    });

    it('should still pull the main record(s) when an included model is not required and has where restrictions without matches', function() {
      var self = this
        , A = this.sequelize.define('a', {name: DataTypes.STRING(40)})
        , B = this.sequelize.define('b', {name: DataTypes.STRING(40)});

      A.hasMany(B);
      B.hasMany(A);

      return this.sequelize
        .sync({force: true})
        .then(function() {
          return A.create({
            name: 'Foobar'
          });
        })
        .then(function() {
          return A.findAll({
            where: {name: 'Foobar'},
            include: [
              {model: B, where: {name: 'idontexist'}, required: false}
            ]
          });
        })
        .then(function(as) {
          expect(as.length).to.equal(1);
          expect(as[0].get('bs')).deep.equal([]);
        });
    });

    it('should work with paranoid, a main record where, an include where, and a limit', function () {
      var Post = this.sequelize.define('post', {
        date: DataTypes.DATE,
        "public": DataTypes.BOOLEAN
      }, {
        paranoid: true
      });
      var Category = this.sequelize.define('category', {
        slug: DataTypes.STRING
      });

      Post.hasMany(Category);
      Category.belongsTo(Post);

      return this.sequelize.sync({force: true}).then(function () {
        return Promise.join(
          Post.create({"public": true}),
          Post.create({"public": true}),
          Post.create({"public": true}),
          Post.create({"public": true})
        ).then(function (posts) {
          return Promise.map(posts.slice(1, 3), function (post) {
            return post.createCategory({slug: 'food'});
          });
        }).then(function () {
          return Post.findAll({
            limit: 2,
            where: {
              "public": true
            },
            include: [
              {
                model: Category,
                where: {
                  slug: 'food'
                }
              }
            ]
          }).then(function (posts) {
            expect(posts.length).to.equal(2);
          });
        });
      });
    });

    it('should work on a nested set of required 1:1 relations', function () {
      var Person = this.sequelize.define("Person", {
        name: {
          type          : Sequelize.STRING,
          allowNull     : false
        }
      });

      var UserPerson = this.sequelize.define("UserPerson", {
        PersonId: {
          type          : Sequelize.INTEGER,
          primaryKey    : true
        },

        rank: {
          type          : Sequelize.STRING
        }
      });

      var User = this.sequelize.define("User", {
        UserPersonId: {
          type          : Sequelize.INTEGER,
          primaryKey    : true
        },

        login: {
          type          : Sequelize.STRING,
          unique        : true,
          allowNull     : false,
        }
      });

      UserPerson.belongsTo(Person, {
        foreignKey: {
          allowNull: false
        },
        onDelete: 'CASCADE'
      });
      Person.hasOne(UserPerson, {
        foreignKey: {
          allowNull: false
        },
        onDelete: 'CASCADE'
      });

      User.belongsTo(UserPerson, {
        foreignKey: {
          name: 'UserPersonId',
          allowNull: false
        },
        onDelete: 'CASCADE'
      });
      UserPerson.hasOne(User, {
        foreignKey: {
          name: 'UserPersonId',
          allowNull: false
        },
        onDelete: 'CASCADE'
      });

      return this.sequelize.sync({force: true}).then(function () {
        return Person.findAll({
          offset        : 0,
          limit         : 20,
          attributes    : ['id', 'name'],
          include       : [{
            model         : UserPerson,
            required      : true,
            attributes    : ['rank'],
            include       : [{
              model         : User,
              required      : true,
              attributes    : ['login']
            }]
          }]
        });
      });
    });

    it('should work with an empty include.where', function () {
      var User = this.sequelize.define('User', {})
        , Company = this.sequelize.define('Company', {})
        , Group = this.sequelize.define('Group', {});

      User.belongsTo(Company);
      User.belongsToMany(Group);
      Group.belongsToMany(User);

      return this.sequelize.sync({force: true}).then(function () {
        return User.findAll({
          include: [
            {model: Group, where: {}},
            {model: Company, where: {}}
          ]
        });
      });
    });

    it('should be able to order on the main table and a required belongsTo relation with custom tablenames and limit ', function () {
      var User = this.sequelize.define('User', {
        lastName: DataTypes.STRING
      }, {tableName: 'dem_users'});
      var Company = this.sequelize.define('Company', {
        rank: DataTypes.INTEGER
      }, {tableName: 'dem_companies'});

      User.belongsTo(Company);
      Company.hasMany(User);

      return this.sequelize.sync({force: true}).then(function () {
        return Promise.join(
          User.create({lastName: 'Albertsen'}),
          User.create({lastName: 'Zenith'}),
          User.create({lastName: 'Hansen'}),
          Company.create({rank: 1}),
          Company.create({rank: 2})
        ).spread(function (albertsen, zenith, hansen, company1, company2) {
          return Promise.join(
            albertsen.setCompany(company1),
            zenith.setCompany(company2),
            hansen.setCompany(company2)
          );
        }).then(function () {
          return User.findAll({
            include: [
              {model: Company, required: true}
            ],
            order: [
              [Company, 'rank', 'ASC'],
              ['lastName', 'DESC']
            ],
            limit: 5
          }).then(function (users) {
            expect(users[0].lastName).to.equal('Albertsen');
            expect(users[0].Company.rank).to.equal(1);

            expect(users[1].lastName).to.equal('Zenith');
            expect(users[1].Company.rank).to.equal(2);

            expect(users[2].lastName).to.equal('Hansen');
            expect(users[2].Company.rank).to.equal(2);
          });
        });
      });
    });
  });
});
