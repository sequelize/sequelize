'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../../index')
  , expect = chai.expect
  , Promise = Sequelize.Promise
  , Support = require(__dirname + '/../../support');

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('scope', function () {
    describe('associations', function () {
      beforeEach(function () {
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
                gte: 5
              }
            }
          },
          scopes: {
            highValue: {
              where: {
                other_value: {
                  gte: 10
                }
              }
            },
            isTony: {
              where: {
                username: 'tony'
              }
            },
            actualValue: function(value) {
              return {
                where: {
                  other_value: value
                }
              };
            },
            lowAccess: {
              where: {
                access_level: {
                  lte: 5
                }
              }
            },
            escape: {
              where: {
                username: "escape'd"
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
            users: {
              include: [
                { model: this.ScopeMe.unscoped(), as: 'users'}
              ]
            },
            reversed: {
              order: [['id', 'DESC']]
            }
          }
        });

        this.Project = this.sequelize.define('Project');
        this.Project.belongsToMany(this.Company, { through: 'CompanyProjects' });
        this.Company.belongsToMany(this.Project, { through: 'CompanyProjects' });

        this.ScopeMe.belongsTo(this.Company);
        this.UserAssociation = this.Company.hasMany(this.ScopeMe, { as: 'users'});

        return this.sequelize.sync({force: true}).bind(this).then(function() {
          return Promise.all([
            this.ScopeMe.create({username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10, parent_id: 1}),
            this.ScopeMe.create({username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11, parent_id: 2}),
            this.ScopeMe.create({username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7, parent_id: 1}),
            this.ScopeMe.create({username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7, parent_id: 1}),
            this.Company.create({active:true}),
            this.Company.create({active:false}),
            this.ScopeMe.create({username: 'bob', email: 'bob@foobar.com', access_level: 1, other_value: 9, parent_id: 5}),
          ]);
        }).spread(function (u1, u2, u3, u4, c1, c2, u5) {
          return Promise.all([
            c1.setUsers([u1, u2, u3, u4]),
            c2.setUsers([u5])
          ]);
        });
      });

      describe('include', function () {
        describe('target', function () {
          it('should scope columns properly', function () {
            // Will error with ambigous column if id is not scoped properly to `Company`.`id`
            return expect(this.Company.findAll({
              where: { id: 1},
              include: [this.UserAssociation]
            })).to.be.resolved;
          });

          it('should apply default scope when including an associations', function () {
            return this.Company.findAll({
              include: [this.UserAssociation]
            }).get(0).then(function (company) {
              expect(company.users).to.have.length(2);
            });
          });

          it('should apply default scope when including a model', function () {
            return this.Company.findAll({
              include: [{ model: this.ScopeMe, as: 'users'}]
            }).get(0).then(function (company) {
              expect(company.users).to.have.length(2);
            });
          });

          it('should be able to include a scoped model', function () {
            return this.Company.findAll({
              include: [{ model: this.ScopeMe.scope('isTony'), as: 'users'}]
            }).get(0).then(function (company) {
              expect(company.users).to.have.length(1);
              expect(company.users[0].get('username')).to.equal('tony');
            });
          });
        });

        describe('source', function () {
          it('should include model with scope', function () {
            return this.Company.scope('users').findAll({ where: { id: 1 } }).get(0).then(function (company) {
              expect(company.users).to.have.length(4);
            });
          });

          it('should be able to override scoped include', function () {
            return this.Company.scope('users').findAll({
              include: [
                { association: this.UserAssociation, where: { username: 'dan'} }
              ]
            }).get(0).then(function (company) {
              expect(company.users).to.have.length(1);
              expect(company.users[0].get('username')).to.equal('dan');
            });
          });

          it('should be able to append to includes', function () {
            // ? or should it
          });
        });
      });

      describe('get', function () {
        beforeEach(function () {
          return Promise.all([
            this.Project.create(),
            this.Company.unscoped().findAll()
          ]).spread(function (p, companies) {
            return p.setCompanies(companies);
          });
        });

        describe('it should be able to unscope', function () {
          it('hasMany', function () {
            return this.Company.find(1).then(function (company) {
              return company.getUsers({ scope: false});
            }).then(function (users) {
              expect(users).to.have.length(4);
            });
          });

          it('hasOne', function () {

          });

          it('belongsTo', function () {
            return this.ScopeMe.unscoped().find({ where: { username: 'bob' }}).then(function (user) {
              return user.getCompany({ scope: false });
            }).then(function (company) {
              expect(company).to.be.ok;
            });
          });

          it('belongsToMany', function () {
            return this.Project.findAll().get(0).then(function (p) {
              return p.getCompanies({ scope: false});
            }).then(function (companies) {
              expect(companies).to.have.length(2);
            });
          });
        });

        describe('it should apply default scope', function () {
          it('hasMany', function () {
            return this.Company.find(1).then(function (company) {
              return company.getUsers();
            }).then(function (users) {
              expect(users).to.have.length(2);
            });
          });

          it('hasOne', function () {

          });

          it('hasMany double', function () {
            // Do we need to - it's deprecated?
          })

          it('belongsTo', function () {
            return this.ScopeMe.unscoped().find({ where: { username: 'bob' }}).then(function (user) {
              return user.getCompany();
            }).then(function (company) {
              expect(company).not.to.be.ok;
            });
          });

          it('belongsToMany', function () {
            return this.Project.findAll().get(0).then(function (p) {
              return p.getCompanies();
            }).then(function (companies) {
              expect(companies).to.have.length(1);
              expect(companies[0].get('active')).to.be.ok;
            });
          });
        });

        describe('it should be able to apply another scope', function () {
          it('hasMany', function () {
            return this.Company.find(1).then(function (company) {
              return company.getUsers({ scope: 'isTony'});
            }).then(function (users) {
              expect(users).to.have.length(1);
              expect(users[0].get('username')).to.equal('tony');
            });
          });

          it('hasOne', function () {

          });

          it('belongsTo', function () {
            return this.ScopeMe.unscoped().find({ where: { username: 'bob' }}).then(function (user) {
              return user.getCompany({ scope: 'notActive' });
            }).then(function (company) {
              expect(company).to.be.ok;
            });
          });

          it('belongsToMany', function () {
            return this.Project.findAll().get(0).then(function (p) {
              return p.getCompanies({ scope: 'reversed' });
            }).then(function (companies) {
              expect(companies).to.have.length(2);
              expect(companies[0].id).to.equal(2);
              expect(companies[1].id).to.equal(1);
            });
          });
        });
      });
    });
  });
});
