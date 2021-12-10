'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('associations', () => {
      beforeEach(async function() {
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

        await this.sequelize.sync({ force: true });

        const [u1, u2, u3, u4, u5, c1, c2] = await Promise.all([
          this.ScopeMe.create({ id: 1, username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, parent_id: 1 }),
          this.ScopeMe.create({ id: 2, username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, parent_id: 2 }),
          this.ScopeMe.create({ id: 3, username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, parent_id: 1 }),
          this.ScopeMe.create({ id: 4, username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, parent_id: 1 }),
          this.ScopeMe.create({ id: 5, username: 'bob', email: 'bob@foobar.com', access_level: 1, other_value: 9, parent_id: 5 }),
          this.Company.create({ id: 1, active: true }),
          this.Company.create({ id: 2, active: false })
        ]);

        await Promise.all([
          c1.setUsers([u1, u2, u3, u4]),
          c2.setUsers([u5])
        ]);
      });

      describe('include', () => {
        it('should scope columns properly', async function() {
          // Will error with ambigous column if id is not scoped properly to `Company`.`id`
          await expect(this.Company.findAll({
            where: { id: 1 },
            include: [this.UserAssociation]
          })).not.to.be.rejected;
        });

        it('should apply default scope when including an associations', async function() {
          const obj = await this.Company.findAll({
            include: [this.UserAssociation]
          });

          const company = await obj[0];
          expect(company.users).to.have.length(2);
        });

        it('should apply default scope when including a model', async function() {
          const obj = await this.Company.findAll({
            include: [{ model: this.ScopeMe, as: 'users' }]
          });

          const company = await obj[0];
          expect(company.users).to.have.length(2);
        });

        it('should be able to include a scoped model', async function() {
          const obj = await this.Company.findAll({
            include: [{ model: this.ScopeMe.scope('isTony'), as: 'users' }]
          });

          const company = await obj[0];
          expect(company.users).to.have.length(1);
          expect(company.users[0].get('username')).to.equal('tony');
        });
      });

      describe('get', () => {
        beforeEach(async function() {
          const [p, companies] = await Promise.all([
            this.Project.create(),
            this.Company.unscoped().findAll()
          ]);

          await p.setCompanies(companies);
        });

        describe('it should be able to unscope', () => {
          it('hasMany', async function() {
            const company = await this.Company.findByPk(1);
            const users = await company.getUsers({ scope: false });
            expect(users).to.have.length(4);
          });

          it('hasOne', async function() {
            await this.Profile.create({
              active: false,
              userId: 1
            });

            const user = await this.ScopeMe.findByPk(1);
            const profile = await user.getProfile({ scope: false });
            expect(profile).to.be.ok;
          });

          it('belongsTo', async function() {
            const user = await this.ScopeMe.unscoped().findOne({ where: { username: 'bob' } });
            const company = await user.getCompany({ scope: false });
            expect(company).to.be.ok;
          });

          it('belongsToMany', async function() {
            const obj = await this.Project.findAll();
            const p = await obj[0];
            const companies = await p.getCompanies({ scope: false });
            expect(companies).to.have.length(2);
          });
        });

        describe('it should apply default scope', () => {
          it('hasMany', async function() {
            const company = await this.Company.findByPk(1);
            const users = await company.getUsers();
            expect(users).to.have.length(2);
          });

          it('hasOne', async function() {
            await this.Profile.create({
              active: false,
              userId: 1
            });

            const user = await this.ScopeMe.findByPk(1);
            const profile = await user.getProfile();
            expect(profile).not.to.be.ok;
          });

          it('belongsTo', async function() {
            const user = await this.ScopeMe.unscoped().findOne({ where: { username: 'bob' } });
            const company = await user.getCompany();
            expect(company).not.to.be.ok;
          });

          it('belongsToMany', async function() {
            const obj = await this.Project.findAll();
            const p = await obj[0];
            const companies = await p.getCompanies();
            expect(companies).to.have.length(1);
            expect(companies[0].get('active')).to.be.ok;
          });
        });

        describe('it should be able to apply another scope', () => {
          it('hasMany', async function() {
            const company = await this.Company.findByPk(1);
            const users = await company.getUsers({ scope: 'isTony' });
            expect(users).to.have.length(1);
            expect(users[0].get('username')).to.equal('tony');
          });

          it('hasOne', async function() {
            await this.Profile.create({
              active: true,
              userId: 1
            });

            const user = await this.ScopeMe.findByPk(1);
            const profile = await user.getProfile({ scope: 'notActive' });
            expect(profile).not.to.be.ok;
          });

          it('belongsTo', async function() {
            const user = await this.ScopeMe.unscoped().findOne({ where: { username: 'bob' } });
            const company = await user.getCompany({ scope: 'notActive' });
            expect(company).to.be.ok;
          });

          it('belongsToMany', async function() {
            const obj = await this.Project.findAll();
            const p = await obj[0];
            const companies = await p.getCompanies({ scope: 'reversed' });
            expect(companies).to.have.length(2);
            expect(companies[0].id).to.equal(2);
            expect(companies[1].id).to.equal(1);
          });
        });
      });

      describe('scope with includes', () => {
        beforeEach(async function() {
          const [c, p1, p2] = await Promise.all([
            this.Company.findByPk(1),
            this.Project.create({ id: 1, active: true }),
            this.Project.create({ id: 2, active: false })
          ]);

          await c.setProjects([p1, p2]);
        });

        it('should scope columns properly', async function() {
          await expect(this.ScopeMe.scope('includeActiveProjects').findAll()).not.to.be.rejected;
        });

        it('should apply scope conditions', async function() {
          const user = await this.ScopeMe.scope('includeActiveProjects').findOne({ where: { id: 1 } });
          expect(user.company.projects).to.have.length(1);
        });

        describe('with different format', () => {
          it('should not throw error', async function() {
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

            await this.sequelize.sync({ force: true });
            const [child, parent] = await Promise.all([Child.create(), Parent.create()]);
            await parent.setChild(child);

            await Parent.scope('children', 'alsoChildren').findOne();
          });
        });

        describe('with find options', () => {
          it('should merge includes correctly', async function() {
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

            await this.sequelize.sync({ force: true });

            await Promise.all([
              Parent.create({ name: 'parent1' }).then(parent => parent.createChild({ name: 'child1' })),
              Parent.create({ name: 'parent2' }).then(parent => parent.createChild({ name: 'child2' }))
            ]);

            const parent = await Parent.scope('testScope1').findOne({
              include: [{
                model: Child,
                attributes: { exclude: ['name'] }
              }]
            });

            expect(parent.get('name')).to.equal('parent2');
            expect(parent.Children).to.have.length(1);
            expect(parent.Children[0].dataValues).not.to.have.property('name');
          });
        });
      });

      describe('scope with options', () => {
        it('should return correct object included foreign_key', async function() {
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

          await this.sequelize.sync({ force: true });
          await Child.create({ secret: 'super secret' });
          const user = await Child.scope('public').findOne();
          expect(user.dataValues).to.have.property('ParentId');
          expect(user.dataValues).not.to.have.property('secret');
        });

        it('should return correct object included foreign_key with defaultScope', async function() {
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

          await this.sequelize.sync({ force: true });
          await Child.create({ secret: 'super secret' });
          const user = await Child.findOne();
          expect(user.dataValues).to.have.property('ParentId');
          expect(user.dataValues).not.to.have.property('secret');
        });

        it('should not throw error', async function() {
          const Clientfile = this.sequelize.define('clientfile');
          const Mission = this.sequelize.define('mission', { secret: Sequelize.STRING });
          const Building = this.sequelize.define('building');
          const MissionAssociation = Clientfile.hasOne(Mission);
          const BuildingAssociation = Clientfile.hasOne(Building);

          await this.sequelize.sync({ force: true });

          await Clientfile.findAll({
            include: [
              {
                association: 'mission',
                where: {
                  secret: 'foo'
                }
              },
              {
                association: 'building'
              }
            ]
          });

          await Clientfile.findAll({
            include: [
              {
                association: MissionAssociation,
                where: {
                  secret: 'foo'
                }
              },
              {
                association: BuildingAssociation
              }
            ]
          });
        });
      });
    });
  });
});
