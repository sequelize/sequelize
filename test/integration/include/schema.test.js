'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Promise = Sequelize.Promise,
  dialect = Support.getTestDialect();

const sortById = function(a, b) {
  return a.id < b.id ? -1 : 1;
};

describe(Support.getTestDialectTeaser('Includes with schemas'), () => {
  describe('findAll', () => {
    beforeEach(function() {
      const self = this;
      this.fixtureA = function() {
        return self.sequelize.dropAllSchemas().then(() => {
          return self.sequelize.createSchema('account').then(() => {
            const AccUser = self.sequelize.define('AccUser', {}, {schema: 'account'}),
              Company = self.sequelize.define('Company', {
                name: DataTypes.STRING
              }, {schema: 'account'}),
              Product = self.sequelize.define('Product', {
                title: DataTypes.STRING
              }, {schema: 'account'}),
              Tag = self.sequelize.define('Tag', {
                name: DataTypes.STRING
              }, {schema: 'account'}),
              Price = self.sequelize.define('Price', {
                value: DataTypes.FLOAT
              }, {schema: 'account'}),
              Customer = self.sequelize.define('Customer', {
                name: DataTypes.STRING
              }, {schema: 'account'}),
              Group = self.sequelize.define('Group', {
                name: DataTypes.STRING
              }, {schema: 'account'}),
              GroupMember = self.sequelize.define('GroupMember', {

              }, {schema: 'account'}),
              Rank = self.sequelize.define('Rank', {
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
              }, {schema: 'account'});

            self.models = {
              AccUser,
              Company,
              Product,
              Tag,
              Price,
              Customer,
              Group,
              GroupMember,
              Rank
            };

            AccUser.hasMany(Product);
            Product.belongsTo(AccUser);

            Product.belongsToMany(Tag, {through: 'product_tag'});
            Tag.belongsToMany(Product, {through: 'product_tag'});
            Product.belongsTo(Tag, {as: 'Category'});
            Product.belongsTo(Company);

            Product.hasMany(Price);
            Price.belongsTo(Product);

            AccUser.hasMany(GroupMember, {as: 'Memberships'});
            GroupMember.belongsTo(AccUser);
            GroupMember.belongsTo(Rank);
            GroupMember.belongsTo(Group);
            Group.hasMany(GroupMember, {as: 'Memberships'});

            return self.sequelize.sync({force: true}).then(() => {
              return Promise.all([
                Group.bulkCreate([
                  {name: 'Developers'},
                  {name: 'Designers'},
                  {name: 'Managers'}
                ]),
                Company.bulkCreate([
                  {name: 'Sequelize'},
                  {name: 'Coca Cola'},
                  {name: 'Bonanza'},
                  {name: 'NYSE'},
                  {name: 'Coshopr'}
                ]),
                Rank.bulkCreate([
                  {name: 'Admin', canInvite: 1, canRemove: 1, canPost: 1},
                  {name: 'Trustee', canInvite: 1, canRemove: 0, canPost: 1},
                  {name: 'Member', canInvite: 1, canRemove: 0, canPost: 0}
                ]),
                Tag.bulkCreate([
                  {name: 'A'},
                  {name: 'B'},
                  {name: 'C'},
                  {name: 'D'},
                  {name: 'E'}
                ])
              ]).then(() => {
                return Promise.all([
                  Group.findAll(),
                  Company.findAll(),
                  Rank.findAll(),
                  Tag.findAll()
                ]);
              }).spread((groups, companies, ranks, tags) => {
                return Promise.each([0, 1, 2, 3, 4], i => {
                  return Promise.all([
                    AccUser.create(),
                    Product.bulkCreate([
                      {title: 'Chair'},
                      {title: 'Desk'},
                      {title: 'Bed'},
                      {title: 'Pen'},
                      {title: 'Monitor'}
                    ]).then(() => {
                      return Product.findAll();
                    })
                  ]).spread((user, products) => {
                    const groupMembers = [
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
          });
        });
      };
    });

    it('should support an include with multiple different association types', function() {
      const self = this;

      return self.sequelize.dropAllSchemas().then(() => {
        return self.sequelize.createSchema('account').then(() => {
          const AccUser = self.sequelize.define('AccUser', {}, {schema: 'account'}),
            Product = self.sequelize.define('Product', {
              title: DataTypes.STRING
            }, {schema: 'account'}),
            Tag = self.sequelize.define('Tag', {
              name: DataTypes.STRING
            }, {schema: 'account'}),
            Price = self.sequelize.define('Price', {
              value: DataTypes.FLOAT
            }, {schema: 'account'}),
            Group = self.sequelize.define('Group', {
              name: DataTypes.STRING
            }, {schema: 'account'}),
            GroupMember = self.sequelize.define('GroupMember', {

            }, {schema: 'account'}),
            Rank = self.sequelize.define('Rank', {
              name: DataTypes.STRING,
              canInvite: {
                type: DataTypes.INTEGER,
                defaultValue: 0
              },
              canRemove: {
                type: DataTypes.INTEGER,
                defaultValue: 0
              }
            }, {schema: 'account'});

          AccUser.hasMany(Product);
          Product.belongsTo(AccUser);

          Product.belongsToMany(Tag, {through: 'product_tag'});
          Tag.belongsToMany(Product, {through: 'product_tag'});
          Product.belongsTo(Tag, {as: 'Category'});

          Product.hasMany(Price);
          Price.belongsTo(Product);

          AccUser.hasMany(GroupMember, {as: 'Memberships'});
          GroupMember.belongsTo(AccUser);
          GroupMember.belongsTo(Rank);
          GroupMember.belongsTo(Group);
          Group.hasMany(GroupMember, {as: 'Memberships'});

          return self.sequelize.sync({force: true}).then(() => {
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
                  AccUser.create(),
                  Product.bulkCreate([
                    {title: 'Chair'},
                    {title: 'Desk'}
                  ]).then(() => {
                    return Product.findAll();
                  })
                ]).spread((user, products) => {
                  return Promise.all([
                    GroupMember.bulkCreate([
                      {AccUserId: user.id, GroupId: groups[0].id, RankId: ranks[0].id},
                      {AccUserId: user.id, GroupId: groups[1].id, RankId: ranks[1].id}
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
              });
            }).then(() => {
              return AccUser.findAll({
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
                  [AccUser.rawAttributes.id, 'ASC']
                ]
              }).then(users => {
                users.forEach(user => {
                  expect(user.Memberships).to.be.ok;
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
    });

    it('should support many levels of belongsTo', function() {
      const A = this.sequelize.define('a', {}, {schema: 'account'}),
        B = this.sequelize.define('b', {}, {schema: 'account'}),
        C = this.sequelize.define('c', {}, {schema: 'account'}),
        D = this.sequelize.define('d', {}, {schema: 'account'}),
        E = this.sequelize.define('e', {}, {schema: 'account'}),
        F = this.sequelize.define('f', {}, {schema: 'account'}),
        G = this.sequelize.define('g', {}, {schema: 'account'}),
        H = this.sequelize.define('h', {}, {schema: 'account'});

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      let b;
      const singles = [
        B,
        C,
        D,
        E,
        F,
        G,
        H
      ];

      return this.sequelize.sync().then(() => {
        return A.bulkCreate([
          {}, {}, {}, {}, {}, {}, {}, {}
        ]).then(() => {
          let previousInstance;
          return Promise.each(singles, model => {
            return model.create({}).then(instance => {
              if (previousInstance) {
                return previousInstance['set'+ Sequelize.Utils.uppercaseFirst(model.name)](instance).then(() => {
                  previousInstance = instance;
                });
              }
              previousInstance = b = instance;
              return void 0;
            });
          });
        }).then(() => {
          return A.findAll();
        }).then(as => {
          const promises = [];
          as.forEach(a => {
            promises.push(a.setB(b));
          });
          return Promise.all(promises);
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

    it('should support ordering with only belongsTo includes', function() {
      const User = this.sequelize.define('SpecialUser', {}, {schema: 'account'}),
        Item = this.sequelize.define('Item', {'test': DataTypes.STRING}, {schema: 'account'}),
        Order = this.sequelize.define('Order', {'position': DataTypes.INTEGER}, {schema: 'account'});

      User.belongsTo(Item, {'as': 'itemA', foreignKey: 'itemA_id'});
      User.belongsTo(Item, {'as': 'itemB', foreignKey: 'itemB_id'});
      User.belongsTo(Order);

      return this.sequelize.sync().then(() => {
        return Promise.all([
          User.bulkCreate([{}, {}, {}]),
          Item.bulkCreate([
            {'test': 'abc'},
            {'test': 'def'},
            {'test': 'ghi'},
            {'test': 'jkl'}
          ]),
          Order.bulkCreate([
            {'position': 2},
            {'position': 3},
            {'position': 1}
          ])
        ]).then(() => {
          return Promise.all([
            User.findAll(),
            Item.findAll({order: ['id']}),
            Order.findAll({order: ['id']})
          ]);
        }).spread((users, items, orders) => {
          return Promise.all([
            users[0].setItemA(items[0]),
            users[0].setItemB(items[1]),
            users[0].setOrder(orders[2]),
            users[1].setItemA(items[2]),
            users[1].setItemB(items[3]),
            users[1].setOrder(orders[1]),
            users[2].setItemA(items[0]),
            users[2].setItemB(items[3]),
            users[2].setOrder(orders[0])
          ]);
        }).spread(() => {
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
        }, {schema: 'account'}),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        ProductTag = this.sequelize.define('ProductTag', {
          priority: DataTypes.INTEGER
        }, {schema: 'account'});

      Product.belongsToMany(Tag, {through: ProductTag});
      Tag.belongsToMany(Product, {through: ProductTag});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
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
        ]).spread(() => {
          return Promise.all([
            Product.findAll(),
            Tag.findAll()
          ]);
        }).spread((products, tags) => {
          return Promise.all([
            products[0].addTag(tags[0], { through: {priority: 1}}),
            products[0].addTag(tags[1], { through: {priority: 2}}),
            products[1].addTag(tags[1], { through: {priority: 1}}),
            products[2].addTag(tags[0], { through: {priority: 3}}),
            products[2].addTag(tags[1], { through: {priority: 1}}),
            products[2].addTag(tags[2], { through: {priority: 2}})
          ]);
        }).spread(() => {
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {}, {schema: 'account'});

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([{}, {}]),
          User.bulkCreate([{}, {}, {}])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            User.findAll()
          ]);
        }).spread((groups, users) => {
          return users[2].setGroup(groups[1]);
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'});

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]),
          User.bulkCreate([{}, {}])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            User.findAll()
          ]);
        }).spread((groups, users) => {
          return Promise.all([
            users[0].setGroup(groups[1]),
            users[1].setGroup(groups[0])
          ]);
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'});

      User.belongsTo(Group);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]),
          User.bulkCreate([{}, {}])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            User.findAll()
          ]);
        }).spread((groups, users) => {
          return Promise.all([
            users[0].setGroup(groups[1]),
            users[1].setGroup(groups[0])
          ]);
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

    it('should be possible to define a belongsTo include as required with child hasMany with limit', function() {
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        Category = this.sequelize.define('Category', {
          category: DataTypes.STRING
        }, {schema: 'account'});

      User.belongsTo(Group);
      Group.hasMany(Category);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]),
          User.bulkCreate([{}, {}]),
          Category.bulkCreate([{}, {}])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            User.findAll(),
            Category.findAll()
          ]);
        }).spread((groups, users, categories) => {
          const promises = [
            users[0].setGroup(groups[1]),
            users[1].setGroup(groups[0])
          ];
          groups.forEach(group => {
            promises.push(group.setCategories(categories));
          });
          return Promise.all(promises);
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        Category = this.sequelize.define('Category', {
          category: DataTypes.STRING
        }, {schema: 'account'});

      User.belongsTo(Group, {as: 'Team'});
      Group.hasMany(Category, {as: 'Tags'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]),
          User.bulkCreate([{}, {}]),
          Category.bulkCreate([{}, {}])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            User.findAll(),
            Category.findAll()
          ]);
        }).spread((groups, users, categories) => {
          const promises = [
            users[0].setTeam(groups[1]),
            users[1].setTeam(groups[0])
          ];
          groups.forEach(group => {
            promises.push(group.setTags(categories));
          });
          return Promise.all(promises);
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        Category = this.sequelize.define('Category', {
          category: DataTypes.STRING
        }, {schema: 'account'});

      User.belongsTo(Group);
      Group.hasMany(Category);

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Group.bulkCreate([
            {name: 'A'},
            {name: 'B'}
          ]),
          User.bulkCreate([{}, {}]),
          Category.bulkCreate([{}, {}])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            User.findAll(),
            Category.findAll()
          ]);
        }).spread((groups, users, categories) => {
          const promises = [
            users[0].setGroup(groups[1]),
            users[1].setGroup(groups[0])
          ];
          groups.forEach(group => {
            promises.push(group.setCategories(categories));
          });
          return Promise.all(promises);
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Project = this.sequelize.define('Project', {
          title: DataTypes.STRING
        }, {schema: 'account'});

      User.hasOne(Project, {as: 'LeaderOf'});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
          Project.bulkCreate([
            {title: 'Alpha'},
            {title: 'Beta'}
          ]),
          User.bulkCreate([{}, {}])
        ]).then(() => {
          return Promise.all([
            Project.findAll(),
            User.findAll()
          ]);
        }).spread((projects, users) => {
          return Promise.all([
            users[1].setLeaderOf(projects[1]),
            users[0].setLeaderOf(projects[0])
          ]);
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
        }, {schema: 'account'}),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        ProductTag = this.sequelize.define('ProductTag', {
          priority: DataTypes.INTEGER
        }, {schema: 'account'});

      Product.belongsToMany(Tag, {through: ProductTag});
      Tag.belongsToMany(Product, {through: ProductTag});

      return this.sequelize.sync({force: true}).then(() => {
        return Promise.all([
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
        ]).then(() => {
          return Promise.all([
            Product.findAll(),
            Tag.findAll()
          ]);
        }).spread((products, tags) => {
          return Promise.all([
            products[0].addTag(tags[0], {priority: 1}),
            products[0].addTag(tags[1], {priority: 2}),
            products[1].addTag(tags[1], {priority: 1}),
            products[2].addTag(tags[0], {priority: 3}),
            products[2].addTag(tags[1], {priority: 1}),
            products[2].addTag(tags[2], {priority: 2})
          ]);
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
        }, {schema: 'account'}),
        Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }, {schema: 'account'}),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        Price = this.sequelize.define('Price', {
          value: DataTypes.FLOAT
        }, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'}),
        GroupMember = this.sequelize.define('GroupMember', {

        }, {schema: 'account'}),
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
        }, {schema: 'account'});

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
          ]),
          Rank.bulkCreate([
            {name: 'Admin', canInvite: 1, canRemove: 1},
            {name: 'Member', canInvite: 1, canRemove: 0}
          ]),
          Tag.bulkCreate([
            {name: 'A'},
            {name: 'B'},
            {name: 'C'}
          ])
        ]).then(() => {
          return Promise.all([
            Group.findAll(),
            Rank.findAll(),
            Tag.findAll()
          ]);
        }).spread((groups, ranks, tags) => {
          return Promise.resolve([0, 1, 2, 3, 4]).each(i => {
            return Promise.all([
              User.create({name: 'FooBarzz'}),
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
      const User = this.sequelize.define('User', {}, {schema: 'account'}),
        Group = this.sequelize.define('Group', {
          name: DataTypes.STRING
        }, {schema: 'account'});

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
            results.users[1].setGroup(results.groups[0]),
            results.users[2].setGroup(results.groups[0]),
            results.users[3].setGroup(results.groups[1]),
            results.users[0].setGroup(results.groups[0])
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
          attributes: ['title'],
          include: [
            {model: self.models.Company, where: {name: 'NYSE'}},
            {model: self.models.Tag},
            {model: self.models.Price}
          ],
          limit: 3,
          order: [
            ['id', 'ASC']
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
        }, {timestamps: false, schema: 'account'}),
        Group = this.sequelize.define('group', {
          dateField: Sequelize.DATE
        }, {timestamps: false, schema: 'account'});

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
                if (dialect === 'sqlite') {
                  expect(new Date(users[0].dateField).getTime()).to.equal(Date.UTC(2014, 1, 20));
                  expect(new Date(users[0].groups[0].dateField).getTime()).to.equal(Date.UTC(2014, 1, 20));
                } else {
                  expect(users[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
                  expect(users[0].groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
                }
              });
            });
          });
        });
      });
    });

  });

  describe('findOne', () => {
    it('should work with schemas', function() {
      const self = this;
      const UserModel = this.sequelize.define('User', {
        Id: {
          type: DataTypes.INTEGER,
          primaryKey: true
        },
        Name: DataTypes.STRING,
        UserType: DataTypes.INTEGER,
        Email: DataTypes.STRING,
        PasswordHash: DataTypes.STRING,
        Enabled: {
          type: DataTypes.BOOLEAN
        },
        CreatedDatetime: DataTypes.DATE,
        UpdatedDatetime: DataTypes.DATE
      }, {
        schema: 'hero',
        tableName: 'User',
        timestamps: false
      });

      const UserIdColumn = { type: Sequelize.INTEGER, references: { model: UserModel, key: 'Id' } };

      const ResumeModel = this.sequelize.define('Resume', {
        Id: {
          type: Sequelize.INTEGER,
          primaryKey: true
        },
        UserId: UserIdColumn,
        Name: Sequelize.STRING,
        Contact: Sequelize.STRING,
        School: Sequelize.STRING,
        WorkingAge: Sequelize.STRING,
        Description: Sequelize.STRING,
        PostType: Sequelize.INTEGER,
        RefreshDatetime: Sequelize.DATE,
        CreatedDatetime: Sequelize.DATE
      }, {
        schema: 'hero',
        tableName: 'resume',
        timestamps: false
      });

      UserModel.hasOne(ResumeModel, {
        foreignKey: 'UserId',
        as: 'Resume'
      });

      ResumeModel.belongsTo(UserModel, {
        foreignKey: 'UserId'
      });

      return self.sequelize.dropAllSchemas().then(() => {
        return self.sequelize.createSchema('hero');
      }).then(() => {
        return self.sequelize.sync({force: true}).then(() => {
          return UserModel.find({
            where: {
              Id: 1
            },
            include: [{
              model: ResumeModel,
              as: 'Resume'
            }]
          });
        });
      });
    });
  });
});
