'use strict';

const chai = require('chai');

const expect = chai.expect;
const { Sequelize, Op, DataTypes, Model } = require('@sequelize/core');

const Support   = require('../support');

const current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  const Project = current.define('project');
  const User = current.define('user', {
    password: DataTypes.STRING,
    value: DataTypes.INTEGER,
    name: DataTypes.STRING,
  }, {
    defaultScope: {
      attributes: {
        exclude: ['password'],
      },
    },
    scopes: {
      aScope: {
        attributes: {
          exclude: ['value'],
        },
      },
    },
  });

  const scopes = {
    complexFunction(value) {
      return {
        where: [`${value} IN (SELECT foobar FROM some_sql_function(foo.bar))`],
      };
    },
    somethingTrue: {
      where: {
        something: true,
        somethingElse: 42,
      },
      limit: 5,
    },
    somethingFalse: {
      where: {
        something: false,
      },
    },
    sequelizeWhere: {
      where: Sequelize.where(),
    },
    users: {
      include: [
        { model: User },
      ],
    },
    alsoUsers: {
      include: [
        { model: User, where: { something: 42 } },
      ],
    },
    projects: {
      include: [Project],
    },
    groupByCompanyId: {
      group: ['company.id'],
    },
    groupByProjectId: {
      group: ['project.id'],
      include: [Project],
    },
    noArgs() {
      // This does not make much sense, since it does not actually need to be in a function,
      // In reality it could be used to do for example new Date or random in the scope - but we want it deterministic

      return {
        where: {
          other_value: 7,
        },
      };
    },
    actualValue(value) {
      return {
        where: {
          other_value: value,
        },
      };
    },
  };

  const Company = current.define('company', {}, {
    defaultScope: {
      include: [Project],
      where: { active: true },
    },
    scopes,
  });

  Company.hasMany(User);
  Company.hasMany(Project);

  describe('.scope', () => {
    describe('attribute exclude / include', () => {
      it('should not expand attributes', () => {
        expect(User._scope.attributes).to.deep.equal({ exclude: ['password'] });
      });

      it('should not expand attributes', () => {
        expect(User.scope('aScope')._scope.attributes).to.deep.equal({ exclude: ['value'] });
      });

      it('should unite attributes with array', () => {
        expect(User.scope('aScope', 'defaultScope')._scope.attributes).to.deep.equal({ exclude: ['value', 'password'] });
      });

      it('should not modify the original scopes when merging them', () => {
        expect(User.scope('defaultScope', 'aScope').options.defaultScope.attributes).to.deep.equal({ exclude: ['password'] });
      });
    });

    it('defaultScope should be an empty object if not overridden', () => {
      const Foo = current.define('foo', {}, {});

      expect(Foo.scope('defaultScope')._scope).to.deep.equal({});
    });

    it('should apply default scope', () => {
      expect(Company._scope).to.deep.equal({
        include: [Project],
        where: { active: true },
      });
    });

    it('should be able to unscope', () => {
      expect(Company.scope(null)._scope).to.be.empty;
      expect(Company.unscoped()._scope).to.be.empty;
      // Yes, being unscoped is also a scope - this prevents inject defaultScope, when including a scoped model, see #4663
      expect(Company.unscoped().scoped).to.be.ok;
    });

    it('should be able to merge scopes', () => {
      expect(Company.scope('somethingTrue', 'somethingFalse', 'sequelizeWhere')._scope).to.deepEqual({
        where: {
          [Op.and]: [
            { something: true, somethingElse: 42 },
            { something: false },
            Sequelize.where(),
          ],
        },
        limit: 5,
      });
    });

    it('should support multiple, coexistent scoped models', () => {
      const scoped1 = Company.scope('somethingTrue');
      const scoped2 = Company.scope('somethingFalse');

      expect(scoped1._scope).to.deepEqual({
        where: {
          something: true,
          somethingElse: 42,
        },
        limit: 5,
      });
      expect(scoped2._scope).to.deepEqual({
        where: {
          something: false,
        },
      });
    });

    it('should work with function scopes', () => {
      expect(Company.scope({ method: ['actualValue', 11] })._scope).to.deepEqual({
        where: {
          other_value: 11,
        },
      });

      expect(Company.scope('noArgs')._scope).to.deepEqual({
        where: {
          other_value: 7,
        },
      });
    });

    it('should work with consecutive function scopes', () => {
      const scope = { method: ['actualValue', 11] };
      expect(Company.scope(scope)._scope).to.deepEqual({
        where: {
          other_value: 11,
        },
      });

      expect(Company.scope(scope)._scope).to.deepEqual({
        where: {
          other_value: 11,
        },
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
          { model: User, association: Company.associations.users, as: 'users' },
          { model: Project, association: Company.associations.projects, as: 'projects'  },
        ],
      });
    });

    it('should be able to keep original scope definition clean', () => {
      expect(Company.scope('projects', 'users', 'alsoUsers')._scope).to.deep.equal({
        include: [
          { model: Project, association: Company.associations.projects, as: 'projects' },
          { model: User, association: Company.associations.users, as: 'users', where: { something: 42 } },
        ],
      });

      expect(Company.options.scopes.alsoUsers).to.deep.equal({
        include: [
          { model: User, association: Company.associations.users, as: 'users', where: { something: 42 } },
        ],
      });

      expect(Company.options.scopes.users).to.deep.equal({
        include: [
          { model: User, association: Company.associations.users, as: 'users' },
        ],
      });
    });

    it('should be able to override the default scope', () => {
      expect(Company.scope('somethingTrue')._scope).to.deepEqual({
        where: {
          something: true,
          somethingElse: 42,
        },
        limit: 5,
      });
    });

    it('should be able to combine default with another scope', () => {
      expect(Company.scope(['defaultScope', { method: ['actualValue', 11] }])._scope).to.deepEqual({
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
        where: {
          [Op.and]: [
            { active: true },
            { other_value: 11 },
          ],
        },
      });
    });

    describe('merging where clause', () => {
      const testModelScopes = {
        whereAttributeIs1: {
          where: {
            field: 1,
          },
        },
        whereAttributeIs2: {
          where: {
            field: 2,
          },
        },
        whereAttributeIs3: {
          where: {
            field: 3,
          },
        },
        whereOtherAttributeIs4: {
          where: {
            otherField: 4,
          },
        },
        whereOpAnd1: {
          where: {
            [Op.and]: [{ field: 1 }, { field: 1 }],
          },
        },
        whereOpAnd2: {
          where: {
            [Op.and]: [{ field: 2 }, { field: 2 }],
          },
        },
        whereOpAnd3: {
          where: {
            [Op.and]: [{ field: 3 }, { field: 3 }],
          },
        },
        whereOpOr1: {
          where: {
            [Op.or]: [{ field: 1 }, { field: 1 }],
          },
        },
        whereOpOr2: {
          where: {
            [Op.or]: [{ field: 2 }, { field: 2 }],
          },
        },
        whereOpOr3: {
          where: {
            [Op.or]: [{ field: 3 }, { field: 3 }],
          },
        },
        whereSequelizeWhere1: {
          where: Sequelize.where('field', Op.is, 1),
        },
        whereSequelizeWhere2: {
          where: Sequelize.where('field', Op.is, 2),
        },
      };

      const TestModel = current.define('testModel', {}, {
        mergeWhereScopesWithAndOperator: true,
        scopes: testModelScopes,
      });

      describe('attributes', () => {
        it('should group 2 similar attributes with an Op.and', () => {
          const scope = TestModel.scope(['whereAttributeIs1', 'whereAttributeIs2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 2 },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group multiple similar attributes with an unique Op.and', () => {
          const scope = TestModel.scope(['whereAttributeIs1', 'whereAttributeIs2', 'whereAttributeIs3'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 2 },
                { field: 3 },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group different attributes with an Op.and', () => {
          const scope = TestModel.scope(['whereAttributeIs1', 'whereOtherAttributeIs4'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { otherField: 4 },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });
      });

      describe('and operators', () => {
        it('should concatenate 2 Op.and into an unique one', () => {
          const scope = TestModel.scope(['whereOpAnd1', 'whereOpAnd2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 1 },
                { field: 2 },
                { field: 2 },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should concatenate multiple Op.and into an unique one', () => {
          const scope = TestModel.scope(['whereOpAnd1', 'whereOpAnd2', 'whereOpAnd3'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 1 },
                { field: 2 },
                { field: 2 },
                { field: 3 },
                { field: 3 },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });
      });

      describe('or operators', () => {
        it('should group 2 Op.or with an Op.and', () => {
          const scope = TestModel.scope(['whereOpOr1', 'whereOpOr2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                { [Op.or]: [{ field: 2 }, { field: 2 }] },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group multiple Op.or with an unique Op.and', () => {
          const scope = TestModel.scope(['whereOpOr1', 'whereOpOr2', 'whereOpOr3'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                { [Op.or]: [{ field: 2 }, { field: 2 }] },
                { [Op.or]: [{ field: 3 }, { field: 3 }] },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group multiple Op.or and Op.and with an unique Op.and', () => {
          const scope = TestModel.scope(['whereOpOr1', 'whereOpOr2', 'whereOpAnd1', 'whereOpAnd2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                { [Op.or]: [{ field: 2 }, { field: 2 }] },
                { field: 1 },
                { field: 1 },
                { field: 2 },
                { field: 2 },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group multiple Op.and and Op.or with an unique Op.and', () => {
          const scope = TestModel.scope(['whereOpAnd1', 'whereOpAnd2', 'whereOpOr1', 'whereOpOr2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 1 },
                { field: 2 },
                { field: 2 },
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                { [Op.or]: [{ field: 2 }, { field: 2 }] },
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });
      });

      describe('sequelize where', () => {
        it('should group 2 sequelize.where with an Op.and', () => {
          const scope = TestModel.scope(['whereSequelizeWhere1', 'whereSequelizeWhere2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                Sequelize.where('field', Op.is, 1),
                Sequelize.where('field', Op.is, 2),
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group 2 sequelize.where and other scopes with an Op.and', () => {
          const scope = TestModel.scope(['whereAttributeIs1', 'whereOpAnd1', 'whereOpOr1', 'whereSequelizeWhere1'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 1 },
                { field: 1 },
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                Sequelize.where('field', Op.is, 1),
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });
      });
    });

    it('should be able to use raw queries', () => {
      expect(Company.scope([{ method: ['complexFunction', 'qux'] }])._scope).to.deepEqual({
        where: ['qux IN (SELECT foobar FROM some_sql_function(foo.bar))'],
      });
    });

    it('should override the default scope', () => {
      expect(Company.scope(['defaultScope', { method: ['complexFunction', 'qux'] }])._scope).to.deepEqual({
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
        where: {
          [Op.and]: [
            { active: true },
            'qux IN (SELECT foobar FROM some_sql_function(foo.bar))',
          ],
        },
      });
    });

    it('should emit an error for scopes that don\'t exist', () => {
      expect(() => {
        Company.scope('doesntexist');
      }).to.throw('"company.scope()" has been called with an invalid scope: "doesntexist" does not exist.');
    });

    it('should concatenate scope groups', () => {
      expect(Company.scope('groupByCompanyId', 'groupByProjectId')._scope).to.deepEqual({
        group: ['company.id', 'project.id'],
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
      });
    });
  });

  describe('addScope', () => {
    it('works if the model does not have any initial scopes', () => {
      const MyModel = current.define('model');

      expect(() => {
        MyModel.addScope('anything', {});
      }).not.to.throw();
    });

    it('allows me to add a new scope', () => {
      expect(() => {
        Company.scope('newScope');
      }).to.throw('"company.scope()" has been called with an invalid scope: "newScope" does not exist.');

      Company.addScope('newScope', {
        where: {
          this: 'that',
        },
        include: [{ model: Project }],
      });

      expect(Company.scope('newScope')._scope).to.deepEqual({
        where: {
          this: 'that',
        },
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
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
          something: false,
        },
      }, { override: true });

      expect(Company.scope('somethingTrue')._scope).to.deepEqual({
        where: {
          something: false,
        },
      });
    });

    it('warns me when overriding an existing default scope', () => {
      expect(() => {
        Company.addScope('defaultScope', {});
      }).to.throw('The scope defaultScope already exists. Pass { override: true } as options to silence this error');
    });

    it('should not warn if default scope is not defined', () => {
      const MyModel = current.define('model');

      expect(() => {
        MyModel.addScope('defaultScope', {});
      }).not.to.throw();
    });

    it('allows me to override a default scope', () => {
      Company.addScope('defaultScope', {
        include: [{ model: Project }],
      }, { override: true });

      expect(Company._scope).to.deep.equal({
        include: [{ model: Project }],
      });
    });

    it('should keep exclude and include attributes', () => {
      Company.addScope('newIncludeScope', {
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt'],
        },
      });

      expect(Company.scope('newIncludeScope')._scope).to.deep.equal({
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt'],
        },
      });
    });

    it('should be able to merge scopes with the same include', () => {
      Company.addScope('project', {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }],
      });
      Company.addScope('alsoProject', {
        include: [{ model: Project, where: { something: true }, limit: 1 }],
      });
      expect(Company.scope(['project', 'alsoProject'])._scope).to.deepEqual({
        include: [{
          model: Project,
          where: {
            [Op.and]: [
              { something: false, somethingElse: 99 },
              { something: true },
            ],
          },
          association: Company.associations.projects,
          as: 'projects',
          limit: 1,
        }],
      });
    });
  });

  describe('_injectScope', () => {
    it('should be able to merge scope and where', () => {
      const MyModel = current.define('model');
      MyModel.addScope('defaultScope', {
        where: { something: true, somethingElse: 42 },
        limit: 15,
        offset: 3,
      });

      const options = {
        where: {
          something: false,
        },
        limit: 9,
      };

      MyModel._normalizeIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options).to.deepEqual({
        where: {
          [Op.and]: [
            { something: true, somethingElse: 42 },
            { something: false },
          ],
        },
        limit: 9,
        offset: 3,
      });
    });

    it('should be able to merge scope and having', () => {
      const MyModel = current.define('model');
      MyModel.addScope('defaultScope', {
        having: { something: true, somethingElse: 42 },
        limit: 15,
        offset: 3,
      });

      const options = {
        having: {
          something: false,
        },
        limit: 9,
      };

      MyModel._normalizeIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options).to.deepEqual({
        having: {
          [Op.and]: [
            { something: true, somethingElse: 42 },
            { something: false },
          ],
        },
        limit: 9,
        offset: 3,
      });
    });

    it('should be able to merge scoped include', () => {
      const MyModel = current.define('model');
      MyModel.hasMany(Project);

      MyModel.addScope('defaultScope', {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }],
      });

      const options = {
        include: [{ model: Project, where: { something: true }, limit: 1 }],
      };

      MyModel._conformIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options.include).to.have.length(1);
      expect(options.include[0]).to.deepEqual({
        model: Project,
        where: {
          [Op.and]: [
            { something: false, somethingElse: 99 },
            { something: true },
          ],
        },
        association: Company.associations.projects,
        as: 'projects',
        limit: 1,
      });
    });

    it('should be able to merge aliased includes with the same model', () => {
      const MyModel = current.define('model');
      MyModel.hasMany(User, { as: 'someUser' });
      MyModel.hasMany(User, { as: 'otherUser' });

      MyModel.addScope('defaultScope', {
        include: [{ model: User, as: 'someUser' }],
      });

      const options = {
        include: [{ model: User, as: 'otherUser' }],
      };

      MyModel._normalizeIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deepEqual({ model: User, as: 'someUser', association: MyModel.associations.someUser });
      expect(options.include[1]).to.deepEqual({ model: User, as: 'otherUser', association: MyModel.associations.otherUser });
    });

    it('should be able to merge scoped include with include in find', () => {
      const MyModel = current.define('model');
      MyModel.hasMany(Project);
      MyModel.hasMany(User);

      MyModel.addScope('defaultScope', {
        include: [
          { model: Project, where: { something: false } },
        ],
      });

      const options = {
        include: [
          { model: User, where: { something: true } },
        ],
      };

      MyModel._normalizeIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({ model: Project, as: 'projects', association: MyModel.associations.projects, where: { something: false } });
      expect(options.include[1]).to.deep.equal({ model: User, as: 'users', association: MyModel.associations.users, where: { something: true } });
    });

    describe('include all', () => {
      it('scope with all', () => {
        const MyModel = current.define('model');
        MyModel.hasMany(User);
        MyModel.hasMany(Project);
        MyModel.addScope('defaultScope', {
          include: [
            { all: true },
          ],
        });

        const options = {
          include: [
            { model: User, where: { something: true } },
          ],
        };

        MyModel._normalizeIncludes(options, MyModel);
        MyModel._injectScope(options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({
          model: User,
          as: 'users',
          association: MyModel.associations.users,
          where: { something: true },
        });
        expect(options.include[1]).to.deep.equal({
          model: Project,
          as: 'projects',
          association: MyModel.associations.projects,
        });
      });

      it('options with all', () => {
        const MyModel = current.define('model');
        MyModel.hasMany(User);
        MyModel.hasMany(Project);
        MyModel.addScope('defaultScope', {
          include: [
            { model: User, where: { something: true } },
          ],
        });

        const options = {
          include: [
            { all: true },
          ],
        };

        MyModel._normalizeIncludes(options, MyModel);
        MyModel._injectScope(options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({
          model: User,
          as: 'users',
          association: MyModel.associations.users,
          where: { something: true },
        });
        expect(options.include[1]).to.deep.equal({
          model: Project,
          as: 'projects',
          association: MyModel.associations.projects,
        });
      });
    });
  });
});
