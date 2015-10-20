'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  var Project = current.define('project')
    , User = current.define('user')
    , Company;

  var scopes = {
    complexFunction: function(value) {
      return {
        where: [(value + ' IN (SELECT foobar FROM some_sql_function(foo.bar))')]
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
    users: {
      include: [
        { model: User }
      ]
    },
    alsoUsers: {
      include: [
        { model: User, where: { something: 42}}
      ]
    },
    projects: {
      include: [Project]
    },
    noArgs: function () {
      // This does not make much sense, since it does not actually need to be in a function,
      // In reality it could be used to do for example new Date or random in the scope - but we want it deterministic

      return {
        where: {
          other_value: 7
        }
      };
    },
    actualValue: function(value) {
      return {
        where: {
          other_value: value
        }
      };
    },
  };

  Company = current.define('company', {}, {
    defaultScope: {
      include: [Project],
      where: { active: true }
    },
    scopes: scopes
  });

  describe('.scope', function () {
    it('should apply default scope', function () {
      expect(Company.$scope).to.deep.equal({
        include: [{ model: Project }],
        where: { active: true }
      });
    });

    it('should be able to unscope', function () {
      expect(Company.scope(null).$scope).to.be.empty;
      expect(Company.unscoped().$scope).to.be.empty;
      // Yes, being unscoped is also a scope - this prevents inject defaultScope, when including a scoped model, see #4663
      expect(Company.unscoped().scoped).to.be.ok;
    });

    it('should be able to merge scopes', function() {
      expect(Company.scope('somethingTrue', 'somethingFalse').$scope).to.deep.equal({
        where: {
          something: false,
          somethingElse: 42
        },
        limit: 5
      });
    });

    it('should support multiple, coexistent scoped models', function () {
      var scoped1 = Company.scope('somethingTrue')
        , scoped2 = Company.scope('somethingFalse');

        expect(scoped1.$scope).to.deep.equal(scopes.somethingTrue);
        expect(scoped2.$scope).to.deep.equal(scopes.somethingFalse);
    });

    it('should work with function scopes', function () {
      expect(Company.scope({method: ['actualValue', 11]}).$scope).to.deep.equal({
        where: {
          other_value: 11
        }
      });

      expect(Company.scope('noArgs').$scope).to.deep.equal({
        where: {
          other_value: 7
        }
      });
    });

    it('should be able to merge two scoped includes', function () {
      expect(Company.scope('users', 'projects').$scope).to.deep.equal({
        include: [
          { model: User },
          { model: Project }
        ]
      });
    });

    it('should be able to override the default scope', function() {
      expect(Company.scope('somethingTrue').$scope).to.deep.equal(scopes.somethingTrue);
    });

    it('should be able to combine default with another scope', function () {
      expect(Company.scope(['defaultScope', {method: ['actualValue', 11]}]).$scope).to.deep.equal({
        include: [{ model: Project }],
        where: {
          active: true,
          other_value: 11
        }
      });
    });

    it('should be able to use raw queries', function () {
      expect(Company.scope([{method: ['complexFunction', 'qux']}]).$scope).to.deep.equal({
        where: [ 'qux IN (SELECT foobar FROM some_sql_function(foo.bar))' ]
      });
    });

    it('should override the default scope', function () {
      expect(Company.scope(['defaultScope', {method: ['complexFunction', 'qux']}]).$scope).to.deep.equal({
        include: [{ model: Project }],
        where: [ 'qux IN (SELECT foobar FROM some_sql_function(foo.bar))' ]
      });
    });

    it('should emit an error for scopes that dont exist', function() {
      expect(function () {
        Company.scope('doesntexist');
      }).to.throw('Invalid scope doesntexist called.');
    });
  });

  describe('addScope', function () {
    it('works if the model does not have any initial scopes', function () {
      var Model = current.define('model');

      expect(function () {
        Model.addScope('anything', {});
      }).not.to.throw();
    });

    it('allows me to add a new scope', function ()  {
      expect(function () {
        Company.scope('newScope');
      }).to.throw('Invalid scope newScope called.');

      Company.addScope('newScope', {
        where: {
          this: 'that'
        },
        include: [Project]
      });

      expect(Company.scope('newScope').$scope).to.deep.equal({
        where: { this: 'that' },
        include: [{ model: Project }]
      });
    });

    it('warns me when overriding an existing scope', function () {
      expect(function () {
        Company.addScope('somethingTrue', {});
      }).to.throw('The scope somethingTrue already exists. Pass { override: true } as options to silence this error');
    });

    it('allows me to override an existing scope', function () {
      Company.addScope('somethingTrue', {
        where: {
          something: false
        }
      }, { override: true });

      expect(Company.scope('somethingTrue').$scope).to.deep.equal({
        where: { something: false },
      });
    });

    it('warns me when overriding an existing default scope', function () {
      expect(function () {
        Company.addScope('defaultScope', {});
      }).to.throw('The scope defaultScope already exists. Pass { override: true } as options to silence this error');
    });

    it('allows me to override a default scope', function () {
      Company.addScope('defaultScope', {
        include: [Project]
      }, { override: true });

      expect(Company.$scope).to.deep.equal({
        include: [{ model: Project }]
      });
    });

    it('works with exclude and include attributes', function () {
      Company.addScope('newIncludeScope', {
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt']
        }
      });

      expect(Company.scope('newIncludeScope').$scope).to.deep.equal({
        attributes: ['id', 'updatedAt', 'foobar']
      });
    });

  });

  describe('$injectScope', function () {
    it('should be able to merge scope and where', function () {
      var scope = {
        where: {
          something: true,
          somethingElse: 42
        },
        limit: 15,
        offset: 3
      };

      var options = {
        where: {
          something: false
        },
        limit: 9
      };

      current.Model.$injectScope(scope, options);

      expect(options).to.deep.equal({
        where: {
          something: false,
          somethingElse: 42
        },
        limit: 9,
        offset: 3
      });
    });

    it('should be able to overwrite multiple scopes with the same include', function () {
      var scope = {
        include: [
          { model: Project, where: { something: false }},
          { model: Project, where: { something: true }}
        ]
      };

      var options = {};

      current.Model.$injectScope(scope, options);

      expect(options.include).to.have.length(1);
      expect(options.include[0]).to.deep.equal({ model: Project, where: { something: true }});
    });

    it('should be able to override scoped include', function () {
      var scope = {
        include: [{ model: Project, where: { something: false }}]
      };

      var options = {
        include: [{ model: Project, where: { something: true }}]
      };

      current.Model.$injectScope(scope, options);

      expect(options.include).to.have.length(1);
      expect(options.include[0]).to.deep.equal({ model: Project, where: { something: true }});
    });

    it('should be able to merge aliassed includes with the same model', function () {
      var scope = {
        include: [{model: User, as: 'someUser'}]
      };

      var options = {
        include: [{model: User, as: 'otherUser'}]
      };

      current.Model.$injectScope(scope, options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({model: User, as: 'otherUser'});
      expect(options.include[1]).to.deep.equal({model: User, as: 'someUser'});
    });

    it('should be able to merge scoped include with include in find', function () {
      var scope = {
        include: [
          { model: Project, where: { something: false }}
        ]
      };

      var options = {
        include: [
          { model: User, where: { something: true }}
        ]
      };

      current.Model.$injectScope(scope, options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({ model: User, where: { something: true }});
      expect(options.include[1]).to.deep.equal({ model: Project, where: { something: false }});
    });

    describe('include all', function () {
      it('scope with all', function () {
        var scope = {
          include: [
            { all: true }
          ]
        };

        var options = {
          include: [
            { model: User, where: { something: true }}
          ]
        };

        current.Model.$injectScope(scope, options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({ model: User, where: { something: true }});
        expect(options.include[1]).to.deep.equal({ all: true });
      });


      it('options with all', function () {
        var scope = {
          include: [
            { model: User, where: { something: true }}
          ]
        };

        var options = {
          include: [
            { all: true }
          ]
        };

        current.Model.$injectScope(scope, options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({ all: true });
        expect(options.include[1]).to.deep.equal({ model: User, where: { something: true }});
      });
    });
  });
});
