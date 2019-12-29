'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Promise = Sequelize.Promise;

const sortById = function(a, b) {
  return a.id < b.id ? -1 : 1;
};

describe(Support.getTestDialectTeaser('Include'), () => {
  describe('findAll', () => {
    beforeEach(function() {
      this.fixtureA = function() {
        const User = this.sequelize.define('User', {}),
          Company = this.sequelize.define('Company', {
            name: DataTypes.STRING
          }),
          Product = this.sequelize.define('Product', {
            title: DataTypes.STRING
          }),
          Tag = this.sequelize.define('Tag', {
            name: DataTypes.STRING
          }),
          Price = this.sequelize.define('Price', {
            value: DataTypes.FLOAT
          }),
          Customer = this.sequelize.define('Customer', {
            name: DataTypes.STRING
          }),
          Group = this.sequelize.define('Group', {
            name: DataTypes.STRING
          }),
          GroupMember = this.sequelize.define('GroupMember', {

          }),
          Rank = this.sequelize.define('Rank', {
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
          User,
          Company,
          Product,
          Tag,
          Price,
          Customer,
          Group,
          GroupMember,
          Rank
        };

        User.hasMany(Product);
        Product.belongsTo(User);

        Product.belongsToMany(Tag, {through: 'product_tag'});
        Tag.belongsToMany(Product, {through: 'product_tag'});
        Product.belongsTo(Tag, {as: 'Category'});
        Product.belongsTo(Company);

        Product.hasMany(Price);
        Price.belongsTo(Product);

        User.hasMany(GroupMember, {as: 'Memberships'});
        GroupMember.belongsTo(User);
        GroupMember.belongsTo(Rank);
        GroupMember.belongsTo(Group);
        Group.hasMany(GroupMember, {as: 'Memberships'});

        return this.sequelize.sync({force: true}).then(() => {
          return Promise.props({
            groups: Group.bulkCreate([
              {name: 'Developers'},
              {name: 'Designers'},
              {name: 'Managers'}
            ]).then(() => {
              return Group.findAll();
            }),
            companies: Company.bulkCreate([
              {name: 'Sequelize'},
              {name: 'Coca Cola'},
              {name: 'Bonanza'},
              {name: 'NYSE'},
              {name: 'Coshopr'}
            ]).then(() => {
              return Company.findAll();
            }),
            ranks: Rank.bulkCreate([
              {name: 'Admin', canInvite: 1, canRemove: 1, canPost: 1},
              {name: 'Trustee', canInvite: 1, canRemove: 0, canPost: 1},
              {name: 'Member', canInvite: 1, canRemove: 0, canPost: 0}
            ]).then(() => {
              return Rank.findAll();
            }),
            tags: Tag.bulkCreate([
              {name: 'A'},
              {name: 'B'},
              {name: 'C'},
              {name: 'D'},
              {name: 'E'}
            ]).then(() => {
              return Tag.findAll();
            })
          }).then(results => {
            const groups = results.groups,
              ranks = results.ranks,
              tags = results.tags,
              companies = results.companies;

            return Promise.each([0, 1, 2, 3, 4], i => {
              return Promise.props({
                user: User.create(),
                products: Product.bulkCreate([
                  {title: 'Chair'},
                  {title: 'Desk'},
                  {title: 'Bed'},
                  {title: 'Pen'},
                  {title: 'Monitor'}
                ]).then(() => {
                  return Product.findAll();
                })
              }).then(results => {
                const user = results.user,
                  products = results.products,
                  groupMembers  = [
                    {AccUserId: user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                    {AccUserId: user.id, GroupId: groups[1].id, RankId: ranks[2].id}
                  ];
                if (i < 3) {
                  groupMembers.push({AccUserId: user.id, GroupId: groups[2].id, RankId: ranks[1].id});
                }

                return Promise.join(
                  GroupMember.bulkCreate(groupMembers),
                  user.setProducts([
                    products[i * 5 + 0],
                    products[i * 5 + 1],
                    products[i * 5 + 3]
                  ]),
                  Promise.join(
                    products[i * 5 + 0].setTags([
                      tags[0],
                      tags[2]
                    ]),
                    products[i * 5 + 1].setTags([
                      tags[1]
                    ]),
                    products[i * 5 + 0].setCategory(tags[1]),
                    products[i * 5 + 2].setTags([
                      tags[0]
                    ]),
                    products[i * 5 + 3].setTags([
                      tags[0]
                    ])
                  ),
                  Promise.join(
                    products[i * 5 + 0].setCompany(companies[4]),
                    products[i * 5 + 1].setCompany(companies[3]),
                    products[i * 5 + 2].setCompany(companies[2]),
                    products[i * 5 + 3].setCompany(companies[1]),
                    products[i * 5 + 4].setCompany(companies[0])
                  ),
                  Price.bulkCreate([
                    {ProductId: products[i * 5 + 0].id, value: 5},
                    {ProductId: products[i * 5 + 0].id, value: 10},
                    {ProductId: products[i * 5 + 1].id, value: 5},
                    {ProductId: products[i * 5 + 1].id, value: 10},
                    {ProductId: products[i * 5 + 1].id, value: 15},
                    {ProductId: products[i * 5 + 1].id, value: 20},
                    {ProductId: products[i * 5 + 2].id, value: 20},
                    {ProductId: products[i * 5 + 3].id, value: 20}
                  ])
                );
              });
            });
          });
        });
      };
    });

    it('should work on a nested set of relations with a where condition in between relations', function() {
      const User = this.sequelize.define('User', {}),
        SubscriptionForm = this.sequelize.define('SubscriptionForm', {}),
        Collection = this.sequelize.define('Collection', {}),
        Category = this.sequelize.define('Category', {}),
        SubCategory = this.sequelize.define('SubCategory', {}),
        Capital = this.sequelize.define('Capital', {});

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

      return this.sequelize.sync({force: true}).then(() => {
        return User.findOne({
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
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          priority: DataTypes.INTEGER
        }),
        Set = this.sequelize.define('Set', {
          title: DataTypes.STRING
        });

      Set.hasMany(Product);
      Product.belongsTo(Set);
      Product.belongsToMany(Tag, {through: ProductTag});
      Tag.belongsToMany(Product, {through: ProductTag});

      return this.sequelize.sync({force: true}).then(() => {
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
        ).then(() => {
          return Promise.join(
            Set.findAll(),
            Product.findAll(),
            Tag.findAll()
          );
        }).spread((sets, products, tags) => {
          return Promise.join(
            sets[0].addProducts([products[0], products[1]]),
            products[0].addTag(tags[0], {priority: 1}).then(() => {
              return products[0].addTag(tags[1], {priority: 2});
            }).then(() => {
              return products[0].addTag(tags[2], {priority: 1});
            }),
            products[1].addTag(tags[1], {priority: 2}).then(() => {
              return products[2].addTag(tags[1], {priority: 3});
            }).then(() => {
              return products[2].addTag(tags[2], {priority: 0});
            })
          );
        }).then(() => {
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

    it('should support an include with multiple different association types', function() {
      const User = this.sequelize.define('User', {}),
        Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        Price = this.sequelize.define('Price', {
          value: DataTypes.FLOAT
        }),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }),
        GroupMember = this.sequelize.define('GroupMember', {

        }),
        Rank = this.sequelize.define('Rank', {
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

      Product.belongsToMany(Tag, {through: 'product_tag'});
      Tag.belongsToMany(Product, {through: 'product_tag'});
      Product.belongsTo(Tag, {as: 'Category'});

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, {as: 'Memberships'});
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, {as: 'Memberships'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'Developers'},
            {name: 'Designers'}
          ]).then(() => {
            return Group.findAll();
          }),
          Rank.bulkCreate([
            {name: 'Admin', canInvite: 1, canRemove: 1},
            {name: 'Member', canInvite: 1, canRemove: 0}
          ]).then(() => {
            return Rank.findAll();
          }),
          Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ]).then(() => {
            return Tag.findAll();
          })
        ]).spread((groups, ranks, tags) => {
          return Promise.each([0, 1, 2, 3, 4], i => {
            return Promise.all([
              User.create(),
              Product.bulkCreate([
                {title: 'Chair'},
                {title: 'Desk'}
              ]).then(() => {
                return Product.findAll();
              })
            ]).spread((user, products) => {
              return Promise.all([
                GroupMember.bulkCreate([
                  {UserId: user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                  {UserId: user.id, GroupId: groups[1].id, RankId: ranks[1].id}
                ]),
                user.setProducts([
                  products[i * 2 + 0],
                  products[i * 2 + 1]
                ]),
                products[i * 2 + 0].setTags([
                  tags[0],
                  tags[2]
                ]),
                products[i * 2 + 1].setTags([
                  tags[1]
                ]),
                products[i * 2 + 0].setCategory(tags[1]),
                Price.bulkCreate([
                  {ProductId: products[i * 2 + 0].id, value: 5},
                  {ProductId: products[i * 2 + 0].id, value: 10},
                  {ProductId: products[i * 2 + 1].id, value: 5},
                  {ProductId: products[i * 2 + 1].id, value: 10},
                  {ProductId: products[i * 2 + 1].id, value: 15},
                  {ProductId: products[i * 2 + 1].id, value: 20}
                ])
              ]);
            });
          }).then(() => {
            return User.findAll({
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
            }).then(users => {
              users.forEach(user => {
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
              });
            });
          });
        });
      });
    });

    it('should support many levels of belongsTo', function() {
      const A = this.sequelize.define('a', {}),
        B = this.sequelize.define('b', {}),
        C = this.sequelize.define('c', {}),
        D = this.sequelize.define('d', {}),
        E = this.sequelize.define('e', {}),
        F = this.sequelize.define('f', {}),
        G = this.sequelize.define('g', {}),
        H = this.sequelize.define('h', {});

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          A.bulkCreate([
            {},
            {},
            {},
            {},
            {},
            {},
            {},
            {}
          ]).then(() => {
            return A.findAll();
          }),
          (function(singles) {
            let promise = Promise.resolve(),
              previousInstance,
              b;

            singles.forEach(model => {
              promise = promise.then(() => {
                return model.create({}).then(instance => {
                  if (previousInstance) {
                    return previousInstance['set'+ Sequelize.Utils.uppercaseFirst(model.name)](instance).then(() => {
                      previousInstance = instance;
                    });
                  } else {
                    previousInstance = b = instance;
                  }
                });
              });
            });

            promise = promise.then(() => {
              return b;
            });

            return promise;
          })([B, C, D, E, F, G, H])
        ).spread((as, b) => {
          return Promise.map(as, a => {
            return a.setB(b);
          });
        }).then(() => {
          return A.findAll({
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
          }).then(as => {
            expect(as.length).to.be.ok;

            as.forEach(a => {
              expect(a.b.c.d.e.f.g.h).to.be.ok;
            });
          });
        });
      });
    });

    it('should support many levels of belongsTo (with a lower level having a where)', function() {
      const A = this.sequelize.define('a', {}),
        B = this.sequelize.define('b', {}),
        C = this.sequelize.define('c', {}),
        D = this.sequelize.define('d', {}),
        E = this.sequelize.define('e', {}),
        F = this.sequelize.define('f', {}),
        G = this.sequelize.define('g', {
          name: DataTypes.STRING
        }),
        H = this.sequelize.define('h', {
          name: DataTypes.STRING
        });

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          A.bulkCreate([
            {},
            {},
            {},
            {},
            {},
            {},
            {},
            {}
          ]).then(() => {
            return A.findAll();
          }),
          (function(singles) {
            let promise = Promise.resolve(),
              previousInstance,
              b;

            singles.forEach(model => {
              const values = {};

              if (model.name === 'g') {
                values.name = 'yolo';
              }

              promise = promise.then(() => {
                return model.create(values).then(instance => {
                  if (previousInstance) {
                    return previousInstance['set'+ Sequelize.Utils.uppercaseFirst(model.name)](instance).then(() => {
                      previousInstance = instance;
                    });
                  } else {
                    previousInstance = b = instance;
                  }
                });
              });
            });

            promise = promise.then(() => {
              return b;
            });

            return promise;
          })([B, C, D, E, F, G, H])
        ).spread((as, b) => {
          return Promise.map(as, a => {
            return a.setB(b);
          });
        }).then(() => {
          return A.findAll({
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
          }).then(as => {
            expect(as.length).to.be.ok;

            as.forEach(a => {
              expect(a.b.c.d.e.f.g.h).to.be.ok;
            });
          });
        });
      });
    });

    it('should support ordering with only belongsTo includes', function() {
      const User = this.sequelize.define('User', {}),
        Item = this.sequelize.define('Item', {'test': DataTypes.STRING}),
        Order = this.sequelize.define('Order', {'position': DataTypes.INTEGER});

      User.belongsTo(Item, {'as': 'itemA', foreignKey: 'itemA_id'});
      User.belongsTo(Item, {'as': 'itemB', foreignKey: 'itemB_id'});
      User.belongsTo(Order);

      return this.sequelize.sync().then(() => {
        return Promise.props({
          users: User.bulkCreate([{}, {}, {}]).then(() => {
            return User.findAll();
          }),
          items: Item.bulkCreate([
            {'test': 'abc'},
            {'test': 'def'},
            {'test': 'ghi'},
            {'test': 'jkl'}
          ]).then(() => {
            return Item.findAll({order: ['id']});
          }),
          orders: Order.bulkCreate([
            {'position': 2},
            {'position': 3},
            {'position': 1}
          ]).then(() => {
            return Order.findAll({order: ['id']});
          })
        }).then(results => {
          const user1 = results.users[0];
          const user2 = results.users[1];
          const user3 = results.users[2];

          const item1 = results.items[0];
          const item2 = results.items[1];
          const item3 = results.items[2];
          const item4 = results.items[3];

          const order1 = results.orders[0];
          const order2 = results.orders[1];
          const order3 = results.orders[2];

          return Promise.join(
            user1.setItemA(item1),
            user1.setItemB(item2),
            user1.setOrder(order3),
            user2.setItemA(item3),
            user2.setItemB(item4),
            user2.setOrder(order2),
            user3.setItemA(item1),
            user3.setItemB(item4),
            user3.setOrder(order1)
          );
        }).then(() => {
          return User.findAll({
            'include': [
              {'model': Item, 'as': 'itemA', where: {test: 'abc'}},
              {'model': Item, 'as': 'itemB'},
              Order],
            'order': [
              [Order, 'position']
            ]
          }).then(as => {
            expect(as.length).to.eql(2);

            expect(as[0].itemA.test).to.eql('abc');
            expect(as[1].itemA.test).to.eql('abc');

            expect(as[0].Order.position).to.eql(1);
            expect(as[1].Order.position).to.eql(2);
          });
        });
      });
    });

    it('should include attributes from through models', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          priority: DataTypes.INTEGER
        });

      Product.belongsToMany(Tag, {through: ProductTag});
      Tag.belongsToMany(Product, {through: ProductTag});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          products: Product.bulkCreate([
            {title: 'Chair'},
            {title: 'Desk'},
            {title: 'Dress'}
          ]).then(() => {
            return Product.findAll();
          }),
          tags: Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ]).then(() => {
            return Tag.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.products[0].addTag(results.tags[0], { through: {priority: 1}}),
            results.products[0].addTag(results.tags[1], { through: {priority: 2}}),
            results.products[1].addTag(results.tags[1], { through: {priority: 1}}),
            results.products[2].addTag(results.tags[0], { through: {priority: 3}}),
            results.products[2].addTag(results.tags[1], { through: {priority: 1}}),
            results.products[2].addTag(results.tags[2], { through: {priority: 2}})
          );
        }).then(() => {
          return Product.findAll({
            include: [
              {model: Tag}
            ],
            order: [
              ['id', 'ASC'],
              [Tag, 'id', 'ASC']
            ]
          }).then(products => {
            expect(products[0].Tags[0].ProductTag.priority).to.equal(1);
            expect(products[0].Tags[1].ProductTag.priority).to.equal(2);

            expect(products[1].Tags[0].ProductTag.priority).to.equal(1);

            expect(products[2].Tags[0].ProductTag.priority).to.equal(3);
            expect(products[2].Tags[1].ProductTag.priority).to.equal(1);
            expect(products[2].Tags[2].ProductTag.priority).to.equal(2);
          });
        });
      });
    });

    it('should support a required belongsTo include', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([{}, {}]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}, {}]).then(() => {
            return User.findAll();
          })
        }).then(results => {
          return results.users[2].setGroup(results.groups[1]);
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, required: true}
            ]
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].Group).to.be.ok;
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        });

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}]).then(() => {
            return User.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[0].setGroup(results.groups[1]),
            results.users[1].setGroup(results.groups[0])
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, where: {name: 'A'}}
            ]
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].Group).to.be.ok;
            expect(users[0].Group.name).to.equal('A');
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        });

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}]).then(() => {
            return User.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[0].setGroup(results.groups[1]),
            results.users[1].setGroup(results.groups[0])
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, required: true}
            ]
          }).then(users => {
            users.forEach(user => {
              expect(user.Group).to.be.ok;
            });
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany not required', function() {
      const Address = this.sequelize.define('Address', { 'active': DataTypes.BOOLEAN }),
        Street = this.sequelize.define('Street', { 'active': DataTypes.BOOLEAN }),
        User = this.sequelize.define('User', { 'username': DataTypes.STRING });

      // Associate
      User.belongsTo(Address, { foreignKey: 'addressId' });
      Address.hasMany(User, { foreignKey: 'addressId' });

      Address.belongsTo(Street, { foreignKey: 'streetId' });
      Street.hasMany(Address, { foreignKey: 'streetId' });

      // Sync
      return this.sequelize.sync({ force: true }).then(() => {
        return Street.create({ active: true }).then(street => {
          return Address.create({ active: true, streetId: street.id }).then(address => {
            return User.create({ username: 'John', addressId: address.id }).then(() => {
              return User.find({
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
              }).then(john => {
                expect(john.Address).to.be.ok;
                expect(john.Address.Street).to.be.ok;
              });
            });
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }),
        Category = this.sequelize.define('Category', {
          category: DataTypes.STRING
        });

      User.belongsTo(Group);
      Group.hasMany(Category);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}]).then(() => {
            return User.findAll();
          }),
          categories: Category.bulkCreate([{}, {}]).then(() => {
            return Category.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[0].setGroup(results.groups[1]),
            results.users[1].setGroup(results.groups[0]),
            Promise.map(results.groups, group => {
              return group.setCategories(results.categories);
            })
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, required: true, include: [
                {model: Category}
              ]}
            ],
            limit: 1
          }).then(users => {
            expect(users.length).to.equal(1);
            users.forEach(user => {
              expect(user.Group).to.be.ok;
              expect(user.Group.Categories).to.be.ok;
            });
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit and aliases', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }),
        Category = this.sequelize.define('Category', {
          category: DataTypes.STRING
        });

      User.belongsTo(Group, {as: 'Team'});
      Group.hasMany(Category, {as: 'Tags'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}]).then(() => {
            return User.findAll();
          }),
          categories: Category.bulkCreate([{}, {}]).then(() => {
            return Category.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[0].setTeam(results.groups[1]),
            results.users[1].setTeam(results.groups[0]),
            Promise.map(results.groups, group => {
              return group.setTags(results.categories);
            })
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, required: true, as: 'Team', include: [
                {model: Category, as: 'Tags'}
              ]}
            ],
            limit: 1
          }).then(users => {
            expect(users.length).to.equal(1);
            users.forEach(user => {
              expect(user.Team).to.be.ok;
              expect(user.Team.Tags).to.be.ok;
            });
          });
        });
      });
    });

    it('should be possible to define a belongsTo include as required with child hasMany which is not required with limit', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }),
        Category = this.sequelize.define('Category', {
          category: DataTypes.STRING
        });

      User.belongsTo(Group);
      Group.hasMany(Category);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}]).then(() => {
            return User.findAll();
          }),
          categories: Category.bulkCreate([{}, {}]).then(() => {
            return Category.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[0].setGroup(results.groups[1]),
            results.users[1].setGroup(results.groups[0]),
            Promise.map(results.groups, group => {
              return group.setCategories(results.categories);
            })
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, required: true, include: [
                {model: Category, required: false}
              ]}
            ],
            limit: 1
          }).then(users => {
            expect(users.length).to.equal(1);
            users.forEach(user => {
              expect(user.Group).to.be.ok;
              expect(user.Group.Categories).to.be.ok;
            });
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a hasOne include', function() {
      const User = this.sequelize.define('User', {}),
        Project = this.sequelize.define('Project', {
          title: DataTypes.STRING
        });

      User.hasOne(Project, {as: 'LeaderOf'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          projects: Project.bulkCreate([
            {title: 'Alpha'},
            {title: 'Beta'}
          ]).then(() => {
            return Project.findAll();
          }),
          users: User.bulkCreate([{}, {}]).then(() => {
            return User.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[1].setLeaderOf(results.projects[1]),
            results.users[0].setLeaderOf(results.projects[0])
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Project, as: 'LeaderOf', where: {title: 'Beta'}}
            ]
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].LeaderOf).to.be.ok;
            expect(users[0].LeaderOf.title).to.equal('Beta');
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on a hasMany include with a through model', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          priority: DataTypes.INTEGER
        });

      Product.belongsToMany(Tag, {through: ProductTag});
      Tag.belongsToMany(Product, {through: ProductTag});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          products: Product.bulkCreate([
            {title: 'Chair'},
            {title: 'Desk'},
            {title: 'Dress'}
          ]).then(() => {
            return Product.findAll();
          }),
          tags: Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ]).then(() => {
            return Tag.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.products[0].addTag(results.tags[0], {priority: 1}),
            results.products[0].addTag(results.tags[1], {priority: 2}),
            results.products[1].addTag(results.tags[1], {priority: 1}),
            results.products[2].addTag(results.tags[0], {priority: 3}),
            results.products[2].addTag(results.tags[1], {priority: 1}),
            results.products[2].addTag(results.tags[2], {priority: 2})
          );
        }).then(() => {
          return Product.findAll({
            include: [
              {model: Tag, where: {name: 'C'}}
            ]
          }).then(products => {
            expect(products.length).to.equal(1);
            expect(products[0].Tags.length).to.equal(1);
          });
        });
      });
    });

    it('should be possible to extend the on clause with a where option on nested includes', function() {
      const User = this.sequelize.define('User', {
          name: DataTypes.STRING
        }),
        Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        Price = this.sequelize.define('Price', {
          value: DataTypes.FLOAT
        }),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }),
        GroupMember = this.sequelize.define('GroupMember', {

        }),
        Rank = this.sequelize.define('Rank', {
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

      Product.belongsToMany(Tag, {through: 'product_tag'});
      Tag.belongsToMany(Product, {through: 'product_tag'});
      Product.belongsTo(Tag, {as: 'Category'});

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, {as: 'Memberships'});
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, {as: 'Memberships'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'Developers'},
            {name: 'Designers'}
          ]).then(() => {
            return Group.findAll();
          }),
          Rank.bulkCreate([
            {name: 'Admin', canInvite: 1, canRemove: 1},
            {name: 'Member', canInvite: 1, canRemove: 0}
          ]).then(() => {
            return Rank.findAll();
          }),
          Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ]).then(() => {
            return Tag.findAll();
          })
        ]).spread((groups, ranks, tags) => {
          return Promise.each([0, 1, 2, 3, 4], i => {
            return Promise.props({
              user: User.create({name: 'FooBarzz'}),
              products: Product.bulkCreate([
                {title: 'Chair'},
                {title: 'Desk'}
              ]).then(() => {
                return Product.findAll();
              })
            }).then(results => {
              return Promise.join(
                GroupMember.bulkCreate([
                  {UserId: results.user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                  {UserId: results.user.id, GroupId: groups[1].id, RankId: ranks[1].id}
                ]),
                results.user.setProducts([
                  results.products[i * 2 + 0],
                  results.products[i * 2 + 1]
                ]),
                Promise.join(
                  results.products[i * 2 + 0].setTags([
                    tags[0],
                    tags[2]
                  ]),
                  results.products[i * 2 + 1].setTags([
                    tags[1]
                  ]),
                  results.products[i * 2 + 0].setCategory(tags[1])
                ),
                Price.bulkCreate([
                  {ProductId: results.products[i * 2 + 0].id, value: 5},
                  {ProductId: results.products[i * 2 + 0].id, value: 10},
                  {ProductId: results.products[i * 2 + 1].id, value: 5},
                  {ProductId: results.products[i * 2 + 1].id, value: 10},
                  {ProductId: results.products[i * 2 + 1].id, value: 15},
                  {ProductId: results.products[i * 2 + 1].id, value: 20}
                ])
              );
            });
          });
        }).then(() => {
          return User.findAll({
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
          }).then(users => {
            users.forEach(user => {
              expect(user.Memberships.length).to.equal(1);
              expect(user.Memberships[0].Rank.name).to.equal('Admin');
              expect(user.Products.length).to.equal(1);
              expect(user.Products[0].Prices.length).to.equal(1);
            });
          });
        });
      });
    });

    it('should be possible to use limit and a where with a belongsTo include', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        });

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.props({
          groups: Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]).then(() => {
            return Group.findAll();
          }),
          users: User.bulkCreate([{}, {}, {}, {}]).then(() => {
            return User.findAll();
          })
        }).then(results => {
          return Promise.join(
            results.users[0].setGroup(results.groups[0]),
            results.users[1].setGroup(results.groups[0]),
            results.users[2].setGroup(results.groups[0]),
            results.users[3].setGroup(results.groups[1])
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Group, where: {name: 'A'}}
            ],
            limit: 2
          }).then(users => {
            expect(users.length).to.equal(2);

            users.forEach(user => {
              expect(user.Group.name).to.equal('A');
            });
          });
        });
      });
    });

    it('should be possible use limit, attributes and a where on a belongsTo with additional hasMany includes', function() {
      const self = this;
      return this.fixtureA().then(() => {
        return self.models.Product.findAll({
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
        }).then(products => {
          expect(products.length).to.equal(3);

          products.forEach(product => {
            expect(product.Company.name).to.equal('NYSE');
            expect(product.Tags.length).to.be.ok;
            expect(product.Prices.length).to.be.ok;
          });
        });
      });
    });

    it('should be possible to have the primary key in attributes', function() {
      const Parent = this.sequelize.define('Parent', {});
      const Child1 = this.sequelize.define('Child1', {});

      Parent.hasMany(Child1);
      Child1.belongsTo(Parent);

      return this.sequelize.sync({force: true}).then(() => {
        return Sequelize.Promise.all([
          Parent.create(),
          Child1.create()
        ]);
      }).spread((parent, child) => {
        return parent.addChild1(child).then(() => {
          return parent;
        });
      }).then(parent => {
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

    it('should be possible to turn off the attributes for the through table', function() {
      const self = this;
      return this.fixtureA().then(() => {
        return self.models.Product.findAll({
          attributes: ['title'],
          include: [
            {model: self.models.Tag, through: {attributes: []}, required: true}
          ]
        }).then(products => {
          products.forEach(product => {
            expect(product.Tags.length).to.be.ok;
            product.Tags.forEach(tag => {
              expect(tag.get().productTags).not.to.be.ok;
            });
          });
        });
      });
    });

    it('should be possible to select on columns inside a through table', function() {
      const self = this;
      return this.fixtureA().then(() => {
        return self.models.Product.findAll({
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
        }).then(products => {
          expect(products).have.length(1);
        });
      });
    });

    it('should be possible to select on columns inside a through table and a limit', function() {
      const self = this;
      return this.fixtureA().then(() => {
        return self.models.Product.findAll({
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
        }).then(products => {
          expect(products).have.length(1);
        });
      });
    });

    // Test case by @eshell
    it('should be possible not to include the main id in the attributes', function() {
      const Member = this.sequelize.define('Member', {
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
      const Album = this.sequelize.define('Album', {
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

      return this.sequelize.sync({force: true}).then(() => {
        const members = [],
          albums = [],
          memberCount = 20;

        for (let i = 1; i <= memberCount; i++) {
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

        return Member.bulkCreate(members).then(() => {
          return Album.bulkCreate(albums).then(() => {
            return Member.findAll({
              attributes: ['email'],
              include: [
                {
                  model: Album
                }
              ]
            }).then(members => {
              expect(members.length).to.equal(20);
              members.forEach(member => {
                expect(member.get('id')).not.to.be.ok;
                expect(member.Albums.length).to.equal(1);
              });
            });
          });
        });
      });
    });

    it('should be possible to use limit and a where on a hasMany with additional includes', function() {
      const self = this;
      return this.fixtureA().then(() => {
        return self.models.Product.findAll({
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
        }).then(products => {
          expect(products.length).to.equal(6);

          products.forEach(product => {
            expect(product.Tags.length).to.be.ok;
            expect(product.Prices.length).to.be.ok;

            product.Prices.forEach(price => {
              expect(price.value).to.be.above(5);
            });
          });
        });
      });
    });

    it('should be possible to use limit and a where on a hasMany with a through model with additional includes', function() {
      const self = this;
      return this.fixtureA().then(() => {
        return self.models.Product.findAll({
          include: [
            {model: self.models.Company},
            {model: self.models.Tag, where: {name: ['A', 'B', 'C']}},
            {model: self.models.Price}
          ],
          limit: 10,
          order: [
            ['id', 'ASC']
          ]
        }).then(products => {
          expect(products.length).to.equal(10);

          products.forEach(product => {
            expect(product.Tags.length).to.be.ok;
            expect(product.Prices.length).to.be.ok;

            product.Tags.forEach(tag => {
              expect(['A', 'B', 'C']).to.include(tag.name);
            });
          });
        });
      });
    });

    it('should support including date fields, with the correct timeszone', function() {
      const User = this.sequelize.define('user', {
          dateField: Sequelize.DATE
        }, {timestamps: false}),
        Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, {timestamps: false});

      User.belongsToMany(Group, {through: 'group_user'});
      Group.belongsToMany(User, {through: 'group_user'});

      return this.sequelize.sync().then(() => {
        return User.create({ dateField: Date.UTC(2014, 1, 20) }).then(user => {
          return Group.create({ dateField: Date.UTC(2014, 1, 20) }).then(group => {
            return user.addGroup(group).then(() => {
              return User.findAll({
                where: {
                  id: user.id
                },
                include: [Group]
              }).then(users => {
                expect(users[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
                expect(users[0].groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
              });
            });
          });
        });
      });
    });

    it('should still pull the main record(s) when an included model is not required and has where restrictions without matches', function() {
      const A = this.sequelize.define('a', {name: DataTypes.STRING(40)}),
        B = this.sequelize.define('b', {name: DataTypes.STRING(40)});

      A.belongsToMany(B, {through: 'a_b'});
      B.belongsToMany(A, {through: 'a_b'});

      return this.sequelize
        .sync({force: true})
        .then(() => {
          return A.create({
            name: 'Foobar'
          });
        })
        .then(() => {
          return A.findAll({
            where: {name: 'Foobar'},
            include: [
              {model: B, where: {name: 'idontexist'}, required: false}
            ]
          });
        })
        .then(as => {
          expect(as.length).to.equal(1);
          expect(as[0].get('bs')).deep.equal([]);
        });
    });

    it('should work with paranoid, a main record where, an include where, and a limit', function() {
      const Post = this.sequelize.define('post', {
        date: DataTypes.DATE,
        'public': DataTypes.BOOLEAN
      }, {
        paranoid: true
      });
      const Category = this.sequelize.define('category', {
        slug: DataTypes.STRING
      });

      Post.hasMany(Category);
      Category.belongsTo(Post);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          Post.create({'public': true}),
          Post.create({'public': true}),
          Post.create({'public': true}),
          Post.create({'public': true})
        ).then(posts => {
          return Promise.map(posts.slice(1, 3), post => {
            return post.createCategory({slug: 'food'});
          });
        }).then(() => {
          return Post.findAll({
            limit: 2,
            where: {
              'public': true
            },
            include: [
              {
                model: Category,
                where: {
                  slug: 'food'
                }
              }
            ]
          }).then(posts => {
            expect(posts.length).to.equal(2);
          });
        });
      });
    });

    it('should work on a nested set of required 1:1 relations', function() {
      const Person = this.sequelize.define('Person', {
        name: {
          type: Sequelize.STRING,
          allowNull: false
        }
      });

      const UserPerson = this.sequelize.define('UserPerson', {
        PersonId: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },

        rank: {
          type: Sequelize.STRING
        }
      });

      const User = this.sequelize.define('User', {
        UserPersonId: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },

        login: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false
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

      return this.sequelize.sync({force: true}).then(() => {
        return Person.findAll({
          offset: 0,
          limit: 20,
          attributes: ['id', 'name'],
          include: [{
            model: UserPerson,
            required: true,
            attributes: ['rank'],
            include: [{
              model: User,
              required: true,
              attributes: ['login']
            }]
          }]
        });
      });
    });

    it('should work with an empty include.where', function() {
      const User = this.sequelize.define('User', {}),
        Company = this.sequelize.define('Company', {}),
        Group = this.sequelize.define('Group', {});

      User.belongsTo(Company);
      User.belongsToMany(Group, { through: 'UsersGroups' });
      Group.belongsToMany(User, { through: 'UsersGroups' });

      return this.sequelize.sync({force: true}).then(() => {
        return User.findAll({
          include: [
            {model: Group, where: {}},
            {model: Company, where: {}}
          ]
        });
      });
    });

    it('should be able to order on the main table and a required belongsTo relation with custom tablenames and limit ', function() {
      const User = this.sequelize.define('User', {
        lastName: DataTypes.STRING
      }, {tableName: 'dem_users'});
      const Company = this.sequelize.define('Company', {
        rank: DataTypes.INTEGER
      }, {tableName: 'dem_companies'});

      User.belongsTo(Company);
      Company.hasMany(User);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.join(
          User.create({lastName: 'Albertsen'}),
          User.create({lastName: 'Zenith'}),
          User.create({lastName: 'Hansen'}),
          Company.create({rank: 1}),
          Company.create({rank: 2})
        ).spread((albertsen, zenith, hansen, company1, company2) => {
          return Promise.join(
            albertsen.setCompany(company1),
            zenith.setCompany(company2),
            hansen.setCompany(company2)
          );
        }).then(() => {
          return User.findAll({
            include: [
              {model: Company, required: true}
            ],
            order: [
              [Company, 'rank', 'ASC'],
              ['lastName', 'DESC']
            ],
            limit: 5
          }).then(users => {
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

    it('should ignore include with attributes: [] (used for aggregates)', function() {
      const Post = this.sequelize.define('Post', {
          title: DataTypes.STRING
        }),
        Comment = this.sequelize.define('Comment', {
          content: DataTypes.TEXT
        });

      Post.Comments = Post.hasMany(Comment, {as: 'comments'});

      return this.sequelize.sync({force: true}).bind(this).then(() => {
        return Post.create({
          title: Math.random().toString(),
          comments: [
            {content: Math.random().toString()},
            {content: Math.random().toString()},
            {content: Math.random().toString()}
          ]
        }, {
          include: [Post.Comments]
        });
      }).then(function() {
        return Post.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', this.sequelize.col('comments.id')), 'commentCount']
          ],
          include: [
            {association: Post.Comments, attributes: []}
          ],
          group: [
            'Post.id'
          ]
        });
      }).then(posts => {
        expect(posts.length).to.equal(1);

        const post = posts[0];

        expect(post.get('comments')).not.to.be.ok;
        expect(parseInt(post.get('commentCount'), 10)).to.equal(3);
      });
    });

    it('should not add primary key when including and aggregating with raw: true', function() {
      const Post = this.sequelize.define('Post', {
          title: DataTypes.STRING
        }),
        Comment = this.sequelize.define('Comment', {
          content: DataTypes.TEXT
        });

      Post.Comments = Post.hasMany(Comment, {as: 'comments'});

      return this.sequelize.sync({force: true}).bind(this).then(() => {
        return Post.create({
          title: Math.random().toString(),
          comments: [
            {content: Math.random().toString()},
            {content: Math.random().toString()},
            {content: Math.random().toString()}
          ]
        }, {
          include: [Post.Comments]
        });
      }).then(function() {
        return Post.findAll({
          attributes: [],
          include: [
            {
              association: Post.Comments,
              attributes: [[this.sequelize.fn('COUNT', this.sequelize.col('comments.id')), 'commentCount']]
            }
          ],
          raw: true
        });
      }).then(posts => {
        expect(posts.length).to.equal(1);

        const post = posts[0];
        expect(post.id).not.to.be.ok;
        expect(parseInt(post['comments.commentCount'], 10)).to.equal(3);
      });
    });

    it('Should return posts with nested include with inner join with a m:n association', function() {

      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      });

      const Entity = this.sequelize.define('Entity', {
        entity_id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        creator: {
          type: DataTypes.STRING,
          allowNull: false
        },
        votes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        }
      });

      const Post = this.sequelize.define('Post', {
        post_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        }
      });

      const TaggableSentient = this.sequelize.define('TaggableSentient', {
        nametag: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      });

      Entity.belongsTo(User, { foreignKey: 'creator', targetKey: 'username' });
      Post.belongsTo(Entity, { foreignKey: 'post_id', targetKey: 'entity_id' });

      Entity.belongsToMany(TaggableSentient, {
        as: 'tags',
        through: { model: 'EntityTag', unique: false },
        foreignKey: 'entity_id',
        otherKey: 'tag_name'
      });

      TaggableSentient.belongsToMany(Entity, {
        as: 'tags',
        through: { model: 'EntityTag', unique: false },
        foreignKey: 'tag_name',
        otherKey: 'entity_id'
      });

      return this.sequelize.sync({ force: true })
        .then(() => User.create({ username: 'bob' }))
        .then(() => TaggableSentient.create({ nametag: 'bob' }))
        .then(() => Entity.create({ creator: 'bob' }))
        .then(entity => Promise.all([
          Post.create({ post_id: entity.entity_id }),
          entity.addTags('bob')
        ]))
        .then(() => Post.findAll({
          include: [{
            model: Entity,
            required: true,
            include: [{
              model: User,
              required: true
            }, {
              model: TaggableSentient,
              as: 'tags',
              required: true,
              through: {
                where: {
                  tag_name: ['bob']
                }
              }
            }]
          }],
          limit: 5,
          offset: 0
        }))
        .then(posts => {
          expect(posts.length).to.equal(1);
          expect(posts[0].Entity.creator).to.equal('bob');
          expect(posts[0].Entity.tags.length).to.equal(1);
          expect(posts[0].Entity.tags[0].EntityTag.tag_name).to.equal('bob');
          expect(posts[0].Entity.tags[0].EntityTag.entity_id).to.equal(posts[0].post_id);
        });
    });

    it('should be able to generate a correct request with inner and outer join', function() {
      const Customer = this.sequelize.define('customer', {
        name: DataTypes.STRING
      });

      const ShippingAddress = this.sequelize.define('shippingAddress', {
        address: DataTypes.STRING,
        verified: DataTypes.BOOLEAN
      });

      const Order = this.sequelize.define('purchaseOrder', {
        description: DataTypes.TEXT
      });

      const Shipment = this.sequelize.define('shipment', {
        trackingNumber: DataTypes.STRING
      });

      Customer.hasMany(ShippingAddress);
      ShippingAddress.belongsTo(Customer);

      Customer.hasMany(Order);
      Order.belongsTo(Customer);

      Shipment.belongsTo(Order);
      Order.hasOne(Shipment);

      return this.sequelize.sync({ force: true }).then(() => {
        return Shipment.findOne({
          include: [{
            model: Order,
            required: true,
            include: [{
              model: Customer,
              include: [{
                model: ShippingAddress,
                where: { verified: true }
              }]
            }]
          }]
        });
      });
    });
  });
});
