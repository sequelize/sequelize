'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Promise = Sequelize.Promise,
  Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('associations', () => {
      beforeEach(function() {
        const sequelize = this.sequelize;

        this.ScopeMe = this.sequelize.define('ScopeMe', {
          username: Sequelize.STRING,
          email: Sequelize.STRING,
          access_level: Sequelize.INTEGER,
          other_value: Sequelize.INTEGER,
          parent_id: Sequelize.INTEGER
        }, {
          defaultScope: {
            where: {
              access_level: {
                [Op.gte]: 5
              }
            }
          },
          scopes: {
            isTony: {
              where: {
                username: 'tony'
              }
            },
            includeActiveProjects() {
              return {
                include: [{
                  model: sequelize.models.company,
                  include: [sequelize.models.project.scope('active')]
                }]
              };
            }
          }
        });

        this.Project = this.sequelize.define('project', {
          active: Sequelize.BOOLEAN
        }, {
          scopes: {
            active: {
              where: {
                active: true
              }
            }
          }
        });

        this.Company = this.sequelize.define('company', {
          active: Sequelize.BOOLEAN
        }, {
          defaultScope: {
            where: { active: true }
          },
          scopes: {
            notActive: {
              where: {
                active: false
              }
            },
            reversed: {
              order: [['id', 'DESC']]
            }
          }
        });

        this.Profile = this.sequelize.define('profile', {
          active: Sequelize.BOOLEAN
        }, {
          defaultScope: {
            where: { active: true }
          },
          scopes: {
            notActive: {
              where: {
                active: false
              }
            }
          }
        });

        this.Project.belongsToMany(this.Company, { through: 'CompanyProjects' });
        this.Company.belongsToMany(this.Project, { through: 'CompanyProjects' });

        this.ScopeMe.hasOne(this.Profile, { foreignKey: 'userId' });

        this.ScopeMe.belongsTo(this.Company);
        this.UserAssociation = this.Company.hasMany(this.ScopeMe, { as: 'users' });

        return this.sequelize.sync({ force: true }).then(() => {
          return Promise.all([
            this.ScopeMe.create({ id: 1, username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, parent_id: 1 }),
            this.ScopeMe.create({ id: 2, username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, parent_id: 2 }),
            this.ScopeMe.create({ id: 3, username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, parent_id: 1 }),
            this.ScopeMe.create({ id: 4, username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, parent_id: 1 }),
            this.ScopeMe.create({ id: 5, username: 'bob', email: 'bob@foobar.com', access_level: 1, other_value: 9, parent_id: 5 }),
            this.Company.create({ id: 1, active: true }),
            this.Company.create({ id: 2, active: false })
          ]);
        }).then(([u1, u2, u3, u4, u5, c1, c2]) => {
          return Promise.all([
            c1.setUsers([u1, u2, u3, u4]),
            c2.setUsers([u5])
          ]);
        });
      });

      describe('include', () => {
        it('should scope columns properly', function() {
          // Will error with ambigous column if id is not scoped properly to `Company`.`id`
          return expect(this.Company.findAll({
            where: { id: 1 },
            include: [this.UserAssociation]
          })).not.to.be.rejected;
        });

        it('should apply default scope when including an associations', function() {
          return this.Company.findAll({
            include: [this.UserAssociation]
          }).get(0).then(company => {
            expect(company.users).to.have.length(2);
          });
        });

        it('should apply default scope when including a model', function() {
          return this.Company.findAll({
            include: [{ model: this.ScopeMe, as: 'users' }]
          }).get(0).then(company => {
            expect(company.users).to.have.length(2);
          });
        });

        it('should be able to include a scoped model', function() {
          return this.Company.findAll({
            include: [{ model: this.ScopeMe.scope('isTony'), as: 'users' }]
          }).get(0).then(company => {
            expect(company.users).to.have.length(1);
            expect(company.users[0].get('username')).to.equal('tony');
          });
        });
      });

      describe('get', () => {
        beforeEach(function() {
          return Promise.all([
            this.Project.create(),
            this.Company.unscoped().findAll()
          ]).then(([p, companies]) => {
            return p.setCompanies(companies);
          });
        });

        describe('it should be able to unscope', () => {
          it('hasMany', function() {
            return this.Company.findByPk(1).then(company => {
              return company.getUsers({ scope: false });
            }).then(users => {
              expect(users).to.have.length(4);
            });
          });

          it('hasOne', function() {
            return this.Profile.create({
              active: false,
              userId: 1
            }).then(() => {
              return this.ScopeMe.findByPk(1);
            }).then(user => {
              return user.getProfile({ scope: false });
            }).then(profile => {
              expect(profile).to.be.ok;
            });
          });

          it('belongsTo', function() {
            return this.ScopeMe.unscoped().findOne({ where: { username: 'bob' } }).then(user => {
              return user.getCompany({ scope: false });
            }).then(company => {
              expect(company).to.be.ok;
            });
          });

          it('belongsToMany', function() {
            return this.Project.findAll().get(0).then(p => {
              return p.getCompanies({ scope: false });
            }).then(companies => {
              expect(companies).to.have.length(2);
            });
          });
        });

        describe('it should apply default scope', () => {
          it('hasMany', function() {
            return this.Company.findByPk(1).then(company => {
              return company.getUsers();
            }).then(users => {
              expect(users).to.have.length(2);
            });
          });

          it('hasOne', function() {
            return this.Profile.create({
              active: false,
              userId: 1
            }).then(() => {
              return this.ScopeMe.findByPk(1);
            }).then(user => {
              return user.getProfile();
            }).then(profile => {
              expect(profile).not.to.be.ok;
            });
          });

          it('belongsTo', function() {
            return this.ScopeMe.unscoped().findOne({ where: { username: 'bob' } }).then(user => {
              return user.getCompany();
            }).then(company => {
              expect(company).not.to.be.ok;
            });
          });

          it('belongsToMany', function() {
            return this.Project.findAll().get(0).then(p => {
              return p.getCompanies();
            }).then(companies => {
              expect(companies).to.have.length(1);
              expect(companies[0].get('active')).to.be.ok;
            });
          });
        });

        describe('it should be able to apply another scope', () => {
          it('hasMany', function() {
            return this.Company.findByPk(1).then(company => {
              return company.getUsers({ scope: 'isTony' });
            }).then(users => {
              expect(users).to.have.length(1);
              expect(users[0].get('username')).to.equal('tony');
            });
          });

          it('hasOne', function() {
            return this.Profile.create({
              active: true,
              userId: 1
            }).then(() => {
              return this.ScopeMe.findByPk(1);
            }).then(user => {
              return user.getProfile({ scope: 'notActive' });
            }).then(profile => {
              expect(profile).not.to.be.ok;
            });
          });

          it('belongsTo', function() {
            return this.ScopeMe.unscoped().findOne({ where: { username: 'bob' } }).then(user => {
              return user.getCompany({ scope: 'notActive' });
            }).then(company => {
              expect(company).to.be.ok;
            });
          });

          it('belongsToMany', function() {
            return this.Project.findAll().get(0).then(p => {
              return p.getCompanies({ scope: 'reversed' });
            }).then(companies => {
              expect(companies).to.have.length(2);
              expect(companies[0].id).to.equal(2);
              expect(companies[1].id).to.equal(1);
            });
          });
        });
      });

      describe('scope with includes', () => {
        beforeEach(function() {
          return Promise.all([
            this.Company.findByPk(1),
            this.Project.create({ id: 1, active: true }),
            this.Project.create({ id: 2, active: false })
          ]).then(([c, p1, p2]) => {
            return c.setProjects([p1, p2]);
          });
        });

        it('should scope columns properly', function() {
          return expect(this.ScopeMe.scope('includeActiveProjects').findAll()).not.to.be.rejected;
        });

        it('should apply scope conditions', function() {
          return this.ScopeMe.scope('includeActiveProjects').findOne({ where: { id: 1 } }).then(user => {
            expect(user.company.projects).to.have.length(1);
          });
        });

        describe('with different format', () => {
          it('should not throw error', function() {
            const Child = this.sequelize.define('Child');
            const Parent = this.sequelize.define('Parent', {}, {
              defaultScope: {
                include: [{ model: Child }]
              },
              scopes: {
                children: {
                  include: [Child]
                }
              }
            });
            Parent.addScope('alsoChildren', {
              include: [{ model: Child }]
            });

            Child.belongsTo(Parent);
            Parent.hasOne(Child);

            return this.sequelize.sync({ force: true }).then(() => {
              return Promise.all([Child.create(), Parent.create()]);
            }).then(([child, parent]) => {
              return parent.setChild(child);
            }).then(() => {
              return Parent.scope('children', 'alsoChildren').findOne();
            });
          });
        });

        describe('with find options', () => {
          it('should merge includes correctly', function() {
            const Child = this.sequelize.define('Child', { name: Sequelize.STRING });
            const Parent = this.sequelize.define('Parent', { name: Sequelize.STRING });
            Parent.addScope('testScope1', {
              include: [{
                model: Child,
                where: {
                  name: 'child2'
                }
              }]
            });
            Parent.hasMany(Child);

            return this.sequelize.sync({ force: true })
              .then(() => {
                return Promise.all([
                  Parent.create({ name: 'parent1' }).then(parent => parent.createChild({ name: 'child1' })),
                  Parent.create({ name: 'parent2' }).then(parent => parent.createChild({ name: 'child2' }))
                ]);
              })
              .then(() => {
                return Parent.scope('testScope1').findOne({
                  include: [{
                    model: Child,
                    attributes: { exclude: ['name'] }
                  }]
                });
              })
              .then(parent => {
                expect(parent.get('name')).to.equal('parent2');
                expect(parent.Children).to.have.length(1);
                expect(parent.Children[0].dataValues).not.to.have.property('name');
              });
          });
        });
      });

      describe('scope with options', () => {
        it('should return correct object included foreign_key', function() {
          const Child = this.sequelize.define('Child', {
            secret: Sequelize.STRING
          }, {
            scopes: {
              public: {
                attributes: {
                  exclude: ['secret']
                }
              }
            }
          });
          const Parent = this.sequelize.define('Parent');
          Child.belongsTo(Parent);
          Parent.hasOne(Child);

          return this.sequelize.sync({ force: true })
            .then(() => Child.create({ secret: 'super secret' }))
            .then(() => Child.scope('public').findOne())
            .then(user => {
              expect(user.dataValues).to.have.property('ParentId');
              expect(user.dataValues).not.to.have.property('secret');
            });
        });

        it('should return correct object included foreign_key with defaultScope', function() {
          const Child = this.sequelize.define('Child', {
            secret: Sequelize.STRING
          }, {
            defaultScope: {
              attributes: {
                exclude: ['secret']
              }
            }
          });
          const Parent = this.sequelize.define('Parent');
          Child.belongsTo(Parent);

          return this.sequelize.sync({ force: true })
            .then(() => Child.create({ secret: 'super secret' }))
            .then(() => Child.findOne())
            .then(user => {
              expect(user.dataValues).to.have.property('ParentId');
              expect(user.dataValues).not.to.have.property('secret');
            });
        });
      });
    });
  });
});
