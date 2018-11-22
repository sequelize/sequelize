'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../../index'),
  Op = Sequelize.Op,
  Support   = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  const Project = current.define('project'),
    User = current.define('user');

  const scopes = {
    complexFunction(value) {
      return {
        where: [`${value} IN (SELECT foobar FROM some_sql_function(foo.bar))`]
      };
    },
    somethingTrue: {
      where: {
        something: true,
        somethingElse: 42
      },
      limit: 5
    },
    somethingFalse: {
      where: {
        something: false
      }
    },
    sequelize_where: {
      where: Sequelize.where()
    },
    users: {
      include: [
        { model: User }
      ]
    },
    alsoUsers: {
      include: [
        { model: User, where: { something: 42 } }
      ]
    },
    projects: {
      include: [Project]
    },
    groupByCompanyId: {
      group: ['company.id']
    },
    groupByProjectId: {
      group: ['project.id'],
      include: [Project]
    },
    noArgs() {
      // This does not make much sense, since it does not actually need to be in a function,
      // In reality it could be used to do for example new Date or random in the scope - but we want it deterministic

      return {
        where: {
          other_value: 7
        }
      };
    },
    actualValue(value) {
      return {
        where: {
          other_value: value
        }
      };
    }
  };

  const Company = current.define('company', {}, {
    defaultScope: {
      include: [Project],
      where: { active: true }
    },
    scopes
  });

  describe('.scope', () => {
    describe('attribute exclude / include', () => {
      const User = current.define('user', {
        password: DataTypes.STRING,
        value: DataTypes.INTEGER,
        name: DataTypes.STRING
      }, {
        defaultScope: {
          attributes: {
            exclude: ['password']
          }
        },
        scopes: {
          aScope: {
            attributes: {
              exclude: ['value']
            }
          }
        }
      });

      it('should not expand attributes', () => {
        expect(User._scope.attributes).to.deep.equal({ exclude: ['password'] });
      });

      it('should not expand attributes', () => {
        expect(User.scope('aScope')._scope.attributes).to.deep.equal({ exclude: ['value'] });
      });

      it('should unite attributes with array', () => {
        expect(User.scope('aScope', 'defaultScope')._scope.attributes).to.deep.equal({ exclude: ['value', 'password'] });
      });
    });

    it('defaultScope should be an empty object if not overridden', () => {
      const Foo = current.define('foo', {}, {});

      expect(Foo.scope('defaultScope')._scope).to.deep.equal({});
    });

    it('should apply default scope', () => {
      expect(Company._scope).to.deep.equal({
        include: [Project],
        where: { active: true }
      });
    });

    it('should be able to unscope', () => {
      expect(Company.scope(null)._scope).to.be.empty;
      expect(Company.unscoped()._scope).to.be.empty;
      // Yes, being unscoped is also a scope - this prevents inject defaultScope, when including a scoped model, see #4663
      expect(Company.unscoped().scoped).to.be.ok;
    });

    it('should be able to merge scopes', () => {
      expect(Company.scope('somethingTrue', 'somethingFalse', 'sequelize_where')._scope).to.deep.equal({
        where: {
          something: false,
          somethingElse: 42,
          [Op.and]: Sequelize.where()
        },
        limit: 5
      });
    });

    it('should support multiple, coexistent scoped models', () => {
      const scoped1 = Company.scope('somethingTrue'),
        scoped2 = Company.scope('somethingFalse');

      expect(scoped1._scope).to.deep.equal(scopes.somethingTrue);
      expect(scoped2._scope).to.deep.equal(scopes.somethingFalse);
    });

    it('should work with function scopes', () => {
      expect(Company.scope({ method: ['actualValue', 11] })._scope).to.deep.equal({
        where: {
          other_value: 11
        }
      });

      expect(Company.scope('noArgs')._scope).to.deep.equal({
        where: {
          other_value: 7
        }
      });
    });

    it('should work with consecutive function scopes', () => {
      const scope = { method: ['actualValue', 11] };
      expect(Company.scope(scope)._scope).to.deep.equal({
        where: {
          other_value: 11
        }
      });

      expect(Company.scope(scope)._scope).to.deep.equal({
        where: {
          other_value: 11
        }
      });
    });

    it('should be able to check default scope name', () => {
      expect(Company._scopeNames).to.include('defaultScope');
    });

    it('should be able to check custom scope name', () => {
      expect(Company.scope('users')._scopeNames).to.include('users');
    });

    it('should be able to check multiple custom scope names', () => {
      expect(Company.scope('users', 'projects')._scopeNames).to.include.members(['users', 'projects']);
    });

    it('should be able to merge two scoped includes', () => {
      expect(Company.scope('users', 'projects')._scope).to.deep.equal({
        include: [
          { model: User },
          { model: Project }
        ]
      });
    });

    it('should be able to override the default scope', () => {
      expect(Company.scope('somethingTrue')._scope).to.deep.equal(scopes.somethingTrue);
    });

    it('should be able to combine default with another scope', () => {
      expect(Company.scope(['defaultScope', { method: ['actualValue', 11] }])._scope).to.deep.equal({
        include: [{ model: Project }],
        where: {
          active: true,
          other_value: 11
        }
      });
    });

    it('should be able to use raw queries', () => {
      expect(Company.scope([{ method: ['complexFunction', 'qux'] }])._scope).to.deep.equal({
        where: ['qux IN (SELECT foobar FROM some_sql_function(foo.bar))']
      });
    });

    it('should override the default scope', () => {
      expect(Company.scope(['defaultScope', { method: ['complexFunction', 'qux'] }])._scope).to.deep.equal({
        include: [{ model: Project }],
        where: ['qux IN (SELECT foobar FROM some_sql_function(foo.bar))']
      });
    });

    it("should emit an error for scopes that don't exist", () => {
      expect(() => {
        Company.scope('doesntexist');
      }).to.throw('Invalid scope doesntexist called.');
    });

    it('should concatenate scope groups', () => {
      expect(Company.scope('groupByCompanyId', 'groupByProjectId')._scope).to.deep.equal({
        group: ['company.id', 'project.id'],
        include: [{ model: Project }]
      });
    });
  });

  describe('addScope', () => {
    it('works if the model does not have any initial scopes', () => {
      const Model = current.define('model');

      expect(() => {
        Model.addScope('anything', {});
      }).not.to.throw();
    });

    it('allows me to add a new scope', () => {
      expect(() => {
        Company.scope('newScope');
      }).to.throw('Invalid scope newScope called.');

      Company.addScope('newScope', {
        where: {
          this: 'that'
        },
        include: [{ model: Project }]
      });

      expect(Company.scope('newScope')._scope).to.deep.equal({
        where: { this: 'that' },
        include: [{ model: Project }]
      });
    });

    it('warns me when overriding an existing scope', () => {
      expect(() => {
        Company.addScope('somethingTrue', {});
      }).to.throw('The scope somethingTrue already exists. Pass { override: true } as options to silence this error');
    });

    it('allows me to override an existing scope', () => {
      Company.addScope('somethingTrue', {
        where: {
          something: false
        }
      }, { override: true });

      expect(Company.scope('somethingTrue')._scope).to.deep.equal({
        where: { something: false }
      });
    });

    it('warns me when overriding an existing default scope', () => {
      expect(() => {
        Company.addScope('defaultScope', {});
      }).to.throw('The scope defaultScope already exists. Pass { override: true } as options to silence this error');
    });

    it('should not warn if default scope is not defined', () => {
      const Model = current.define('model');

      expect(() => {
        Model.addScope('defaultScope', {});
      }).not.to.throw();
    });

    it('allows me to override a default scope', () => {
      Company.addScope('defaultScope', {
        include: [{ model: Project }]
      }, { override: true });

      expect(Company._scope).to.deep.equal({
        include: [{ model: Project }]
      });
    });

    it('should keep exclude and include attributes', () => {
      Company.addScope('newIncludeScope', {
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt']
        }
      });

      expect(Company.scope('newIncludeScope')._scope).to.deep.equal({
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt']
        }
      });
    });

    it('should be able to merge scopes with the same include', () => {
      Company.addScope('project', {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }]
      });
      Company.addScope('alsoProject', {
        include: [{ model: Project, where: { something: true }, limit: 1 }]
      });
      expect(Company.scope(['project', 'alsoProject'])._scope).to.deep.equal({
        include: [{ model: Project, where: { something: true, somethingElse: 99 }, limit: 1 }]
      });
    });
  });

  describe('_injectScope', () => {
    it('should be able to merge scope and where', () => {
      Sequelize.Model._scope = {
        where: {
          something: true,
          somethingElse: 42
        },
        limit: 15,
        offset: 3
      };

      const options = {
        where: {
          something: false
        },
        limit: 9
      };

      Sequelize.Model._injectScope(options);

      expect(options).to.deep.equal({
        where: {
          something: false,
          somethingElse: 42
        },
        limit: 9,
        offset: 3
      });
    });

    it('should be able to merge scopes with the same include', () => {
      Sequelize.Model._scope = {
        include: [
          { model: Project, where: { something: false, somethingElse: 99 } },
          { model: Project, where: { something: true }, limit: 1 }
        ]
      };

      const options = {};

      Sequelize.Model._injectScope(options);

      expect(options.include).to.have.length(1);
      expect(options.include[0]).to.deep.equal({ model: Project, where: { something: true, somethingElse: 99 }, limit: 1 });
    });

    it('should be able to merge scoped include', () => {
      Sequelize.Model._scope = {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }]
      };

      const options = {
        include: [{ model: Project, where: { something: true }, limit: 1 }]
      };

      Sequelize.Model._injectScope(options);

      expect(options.include).to.have.length(1);
      expect(options.include[0]).to.deep.equal({ model: Project, where: { something: true, somethingElse: 99 }, limit: 1 });
    });

    it('should be able to merge aliased includes with the same model', () => {
      Sequelize.Model._scope = {
        include: [{ model: User, as: 'someUser' }]
      };

      const options = {
        include: [{ model: User, as: 'otherUser' }]
      };

      Sequelize.Model._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({ model: User, as: 'someUser' });
      expect(options.include[1]).to.deep.equal({ model: User, as: 'otherUser' });
    });

    it('should be able to merge scoped include with include in find', () => {
      Sequelize.Model._scope = {
        include: [
          { model: Project, where: { something: false } }
        ]
      };

      const options = {
        include: [
          { model: User, where: { something: true } }
        ]
      };

      Sequelize.Model._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({ model: Project, where: { something: false } });
      expect(options.include[1]).to.deep.equal({ model: User, where: { something: true } });
    });

    describe('include all', () => {
      it('scope with all', () => {
        Sequelize.Model._scope = {
          include: [
            { all: true }
          ]
        };

        const options = {
          include: [
            { model: User, where: { something: true } }
          ]
        };

        Sequelize.Model._injectScope(options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({ all: true });
        expect(options.include[1]).to.deep.equal({ model: User, where: { something: true } });
      });


      it('options with all', () => {
        Sequelize.Model._scope = {
          include: [
            { model: User, where: { something: true } }
          ]
        };

        const options = {
          include: [
            { all: true }
          ]
        };

        Sequelize.Model._injectScope(options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({ model: User, where: { something: true } });
        expect(options.include[1]).to.deep.equal({ all: true });
      });
    });
  });
});