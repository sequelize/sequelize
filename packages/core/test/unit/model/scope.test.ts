import type { FindOptions } from '@sequelize/core';
import { DataTypes, Op, Sequelize, col, literal, where } from '@sequelize/core';
import { expect } from 'chai';
import assert from 'node:assert';
import { beforeEach2, getTestDialectTeaser, resetSequelizeInstance } from '../../support';

const sequelize = require('../../support').sequelize;

describe(getTestDialectTeaser('Model'), () => {
  beforeEach(() => {
    resetSequelizeInstance();
  });

  function getModels() {
    const Project = sequelize.define('project', {});
    const User = sequelize.define(
      'user',
      {
        password: DataTypes.STRING,
        value: DataTypes.INTEGER,
        name: DataTypes.STRING,
      },
      {
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
      },
    );

    const Company = sequelize.define(
      'company',
      {},
      {
        defaultScope: {
          include: [Project],
          where: { active: true },
        },
        scopes: {
          complexFunction(value: any): FindOptions {
            return {
              where: literal(`${value} IN (SELECT foobar FROM some_sql_function(foo.bar))`),
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
            where: where(col('a'), 1),
          },
          users: {
            include: [{ model: User }],
          },
          alsoUsers: {
            include: [{ model: User, where: { something: 42 } }],
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
          actualValue(value: any) {
            return {
              where: {
                other_value: value,
              },
            };
          },
        },
      },
    );

    Company.hasMany(User);
    Company.hasMany(Project);

    return { Project, User, Company };
  }

  describe('withScope', () => {
    describe('attribute exclude / include', () => {
      const vars = beforeEach2(() => {
        const User = sequelize.define(
          'User',
          {
            password: DataTypes.STRING,
            value: DataTypes.INTEGER,
            name: DataTypes.STRING,
          },
          {
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
          },
        );

        return { User };
      });

      it('should not expand attributes', () => {
        const { User } = vars;
        expect(User._scope.attributes).to.deep.equal({ exclude: ['password'] });
      });

      it('should not expand attributes', () => {
        const { User } = vars;
        expect(User.withScope('aScope')._scope.attributes).to.deep.equal({ exclude: ['value'] });
      });

      it('should unite attributes with array', () => {
        const { User } = vars;
        expect(User.withScope('aScope', 'defaultScope')._scope.attributes).to.deep.equal({
          exclude: ['value', 'password'],
        });
      });

      it('should not modify the original scopes when merging them', () => {
        const { User } = vars;
        expect(
          User.withScope('defaultScope', 'aScope').options.defaultScope!.attributes,
        ).to.deep.equal({ exclude: ['password'] });
      });
    });

    it('defaultScope should be an empty object if not overridden', () => {
      const Foo = sequelize.define('foo', {}, {});

      expect(Foo.withScope('defaultScope')._scope).to.deep.equal({});
    });

    it('should apply default scope', () => {
      const { Company, Project } = getModels();

      expect(Company._scope).to.deep.equal({
        include: [Project],
        where: { active: true },
      });
    });

    it('should be able to merge scopes', () => {
      const { Company } = getModels();

      expect(
        Company.withScope('somethingTrue', 'somethingFalse', 'sequelizeWhere')._scope,
      ).to.deep.equal({
        where: {
          [Op.and]: [
            { something: true, somethingElse: 42 },
            { something: false },
            where(col('a'), 1),
          ],
        },
        limit: 5,
      });
    });

    it('should support multiple, coexistent scoped models', () => {
      const { Company } = getModels();

      const scoped1 = Company.withScope('somethingTrue');
      const scoped2 = Company.withScope('somethingFalse');

      expect(scoped1._scope).to.deep.equal({
        where: {
          something: true,
          somethingElse: 42,
        },
        limit: 5,
      });
      expect(scoped2._scope).to.deep.equal({
        where: {
          something: false,
        },
      });
    });

    it('should work with function scopes', () => {
      const { Company } = getModels();

      expect(Company.withScope({ method: ['actualValue', 11] })._scope).to.deep.equal({
        where: {
          other_value: 11,
        },
      });

      expect(Company.withScope('noArgs')._scope).to.deep.equal({
        where: {
          other_value: 7,
        },
      });
    });

    it('should work with consecutive function scopes', () => {
      const { Company } = getModels();

      const scope = { method: ['actualValue', 11] };
      expect(Company.withScope(scope)._scope).to.deep.equal({
        where: {
          other_value: 11,
        },
      });

      expect(Company.withScope(scope)._scope).to.deep.equal({
        where: {
          other_value: 11,
        },
      });
    });

    it('should be able to check default scope name', () => {
      const { Company } = getModels();

      expect(Company._scopeNames).to.include('defaultScope');
    });

    it('should be able to check custom scope name', () => {
      const { Company } = getModels();

      expect(Company.withScope('users')._scopeNames).to.include('users');
    });

    it('should be able to check multiple custom scope names', () => {
      const { Company } = getModels();

      expect(Company.withScope('users', 'projects')._scopeNames).to.include.members([
        'users',
        'projects',
      ]);
    });

    it('should be able to merge two scoped includes', () => {
      const { Company, Project, User } = getModels();

      expect(Company.withScope('users', 'projects')._scope).to.deep.equal({
        include: [
          { model: User, association: Company.associations.users, as: 'users' },
          { model: Project, association: Company.associations.projects, as: 'projects' },
        ],
      });
    });

    it('should be able to keep original scope definition clean', () => {
      const { Company, Project, User } = getModels();

      expect(Company.withScope('projects', 'users', 'alsoUsers')._scope).to.deep.equal({
        include: [
          { model: Project, association: Company.associations.projects, as: 'projects' },
          {
            model: User,
            association: Company.associations.users,
            as: 'users',
            where: { something: 42 },
          },
        ],
      });

      expect(Company.options.scopes!.alsoUsers).to.deep.equal({
        include: [
          {
            model: User,
            association: Company.associations.users,
            as: 'users',
            where: { something: 42 },
          },
        ],
      });

      expect(Company.options.scopes!.users).to.deep.equal({
        include: [{ model: User, association: Company.associations.users, as: 'users' }],
      });
    });

    it('should be able to override the default scope', () => {
      const { Company } = getModels();

      expect(Company.withScope('somethingTrue')._scope).to.deep.equal({
        where: {
          something: true,
          somethingElse: 42,
        },
        limit: 5,
      });
    });

    it('should be able to combine default with another scope', () => {
      const { Company, Project } = getModels();

      expect(
        Company.withScope(['defaultScope', { method: ['actualValue', 11] }])._scope,
      ).to.deep.equal({
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
        where: {
          [Op.and]: [{ active: true }, { other_value: 11 }],
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
          where: where(col('field'), Op.is, 1),
        },
        whereSequelizeWhere2: {
          where: where(col('field'), Op.is, 2),
        },
      };

      const vars = beforeEach2(() => {
        const TestModel = sequelize.define(
          'TestModel',
          {},
          {
            scopes: testModelScopes,
          },
        );

        return { TestModel };
      });

      describe('attributes', () => {
        it('should group 2 similar attributes with an Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope(['whereAttributeIs1', 'whereAttributeIs2'])._scope;
          const expected = {
            where: {
              [Op.and]: [{ field: 1 }, { field: 2 }],
            },
          };
          expect(scope).to.deep.equal(expected);
        });

        it('should group multiple similar attributes with an unique Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope([
            'whereAttributeIs1',
            'whereAttributeIs2',
            'whereAttributeIs3',
          ])._scope;
          const expected = {
            where: {
              [Op.and]: [{ field: 1 }, { field: 2 }, { field: 3 }],
            },
          };
          expect(scope).to.deep.equal(expected);
        });

        it('should group different attributes with an Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope(['whereAttributeIs1', 'whereOtherAttributeIs4'])._scope;
          const expected = {
            where: {
              [Op.and]: [{ field: 1 }, { otherField: 4 }],
            },
          };
          expect(scope).to.deep.equal(expected);
        });
      });

      describe('and operators', () => {
        it('should concatenate 2 Op.and into an unique one', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope(['whereOpAnd1', 'whereOpAnd2'])._scope;
          const expected = {
            where: {
              [Op.and]: [{ field: 1 }, { field: 1 }, { field: 2 }, { field: 2 }],
            },
          };
          expect(scope).to.deep.equal(expected);
        });

        it('should concatenate multiple Op.and into an unique one', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope(['whereOpAnd1', 'whereOpAnd2', 'whereOpAnd3'])._scope;
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
          expect(scope).to.deep.equal(expected);
        });
      });

      describe('or operators', () => {
        it('should group 2 Op.or with an Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope(['whereOpOr1', 'whereOpOr2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                { [Op.or]: [{ field: 2 }, { field: 2 }] },
              ],
            },
          };
          expect(scope).to.deep.equal(expected);
        });

        it('should group multiple Op.or with an unique Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope(['whereOpOr1', 'whereOpOr2', 'whereOpOr3'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                { [Op.or]: [{ field: 2 }, { field: 2 }] },
                { [Op.or]: [{ field: 3 }, { field: 3 }] },
              ],
            },
          };
          expect(scope).to.deep.equal(expected);
        });

        it('should group multiple Op.or and Op.and with an unique Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope([
            'whereOpOr1',
            'whereOpOr2',
            'whereOpAnd1',
            'whereOpAnd2',
          ])._scope;
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
          expect(scope).to.deep.equal(expected);
        });

        it('should group multiple Op.and and Op.or with an unique Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope([
            'whereOpAnd1',
            'whereOpAnd2',
            'whereOpOr1',
            'whereOpOr2',
          ])._scope;
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
          expect(scope).to.deep.equal(expected);
        });
      });

      describe('sequelize where', () => {
        it('should group 2 sequelize.where with an Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope([
            'whereSequelizeWhere1',
            'whereSequelizeWhere2',
          ])._scope;
          const expected = {
            where: {
              [Op.and]: [where(col('field'), Op.is, 1), where(col('field'), Op.is, 2)],
            },
          };
          expect(scope).to.deep.equal(expected);
        });

        it('should group 2 sequelize.where and other scopes with an Op.and', () => {
          const { TestModel } = vars;

          const scope = TestModel.withScope([
            'whereAttributeIs1',
            'whereOpAnd1',
            'whereOpOr1',
            'whereSequelizeWhere1',
          ])._scope;
          const expected = {
            where: {
              [Op.and]: [
                { field: 1 },
                { field: 1 },
                { field: 1 },
                { [Op.or]: [{ field: 1 }, { field: 1 }] },
                Sequelize.where(col('field'), Op.is, 1),
              ],
            },
          };
          expect(scope).to.deep.equal(expected);
        });
      });
    });

    it('should be able to use raw queries', () => {
      const { Company } = getModels();

      expect(Company.withScope([{ method: ['complexFunction', 'qux'] }])._scope).to.deep.equal({
        where: literal('qux IN (SELECT foobar FROM some_sql_function(foo.bar))'),
      });
    });

    it('should override the default scope', () => {
      const { Company, Project } = getModels();

      expect(
        Company.withScope(['defaultScope', { method: ['complexFunction', 'qux'] }])._scope,
      ).to.deep.equal({
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
        where: {
          [Op.and]: [
            { active: true },
            literal('qux IN (SELECT foobar FROM some_sql_function(foo.bar))'),
          ],
        },
      });
    });

    it("should emit an error for scopes that don't exist", () => {
      const { Company } = getModels();

      expect(() => {
        Company.withScope('doesntexist');
      }).to.throw(
        '"company.withScope()" has been called with an invalid scope: "doesntexist" does not exist.',
      );
    });

    it('should concatenate scope groups', () => {
      const { Company, Project } = getModels();

      expect(Company.withScope('groupByCompanyId', 'groupByProjectId')._scope).to.deep.equal({
        group: ['company.id', 'project.id'],
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
      });
    });
  });

  describe('withoutScope', () => {
    it('returns a model with no scope (including the default scope)', () => {
      const { Company } = getModels();

      expect(Company.withScope(null)._scope).to.be.empty;
      expect(Company.withoutScope()._scope).to.be.empty;
      // Yes, being unscoped is also a scope - this prevents inject defaultScope, when including a scoped model, see #4663
      expect(Company.withoutScope().scoped).to.be.true;
    });

    it('returns the same model no matter which variant it was called on', () => {
      const { Company } = getModels();

      assert(Company.withoutScope() === Company.withScope('somethingTrue').withoutScope());
    });

    it('returns the same model if used with schema', () => {
      const { Company } = getModels();

      assert(
        Company.withSchema('schema1').withoutScope() ===
          Company.withoutScope().withSchema('schema1'),
      );
    });
  });

  describe('withInitialScope', () => {
    it('returns the initial model if no schema is defined', () => {
      const { Company } = getModels();

      assert(Company.withScope('somethingTrue').withInitialScope() === Company);
    });

    it('returns the a model with just the schema if one was defined is defined', () => {
      const { Company } = getModels();

      assert(
        Company.withSchema('schema1').withInitialScope() ===
          Company.withInitialScope().withSchema('schema1'),
      );
    });
  });

  describe('addScope', () => {
    it('works if the model does not have any initial scopes', () => {
      const MyModel = sequelize.define('model');

      expect(() => {
        MyModel.addScope('anything', {});
      }).not.to.throw();
    });

    it('allows me to add a new scope', () => {
      const { Company, Project } = getModels();

      expect(() => {
        Company.withScope('newScope');
      }).to.throw(
        '"company.withScope()" has been called with an invalid scope: "newScope" does not exist.',
      );

      Company.addScope('newScope', {
        where: {
          this: 'that',
        },
        include: [{ model: Project }],
      });

      expect(Company.withScope('newScope')._scope).to.deep.equal({
        where: {
          this: 'that',
        },
        include: [{ model: Project, association: Company.associations.projects, as: 'projects' }],
      });
    });

    it('warns me when overriding an existing scope', () => {
      const { Company } = getModels();

      expect(() => {
        Company.addScope('somethingTrue', {});
      }).to.throw(
        'The scope somethingTrue already exists. Pass { override: true } as options to silence this error',
      );
    });

    it('allows me to override an existing scope', () => {
      const { Company } = getModels();

      Company.addScope(
        'somethingTrue',
        {
          where: {
            something: false,
          },
        },
        { override: true },
      );

      expect(Company.withScope('somethingTrue')._scope).to.deep.equal({
        where: {
          something: false,
        },
      });
    });

    it('warns me when overriding an existing default scope', () => {
      const { Company } = getModels();

      expect(() => {
        Company.addScope('defaultScope', {});
      }).to.throw(
        'The scope defaultScope already exists. Pass { override: true } as options to silence this error',
      );
    });

    it('should not warn if default scope is not defined', () => {
      const MyModel = sequelize.define('model');

      expect(() => {
        MyModel.addScope('defaultScope', {});
      }).not.to.throw();
    });

    it('allows me to override a default scope', () => {
      const { Company, Project } = getModels();

      Company.addScope(
        'defaultScope',
        {
          include: [{ model: Project }],
        },
        { override: true },
      );

      expect(Company._scope).to.deep.equal({
        include: [{ model: Project }],
      });
    });

    it('should keep exclude and include attributes', () => {
      const { Company } = getModels();

      Company.addScope('newIncludeScope', {
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt'],
        },
      });

      expect(Company.withScope('newIncludeScope')._scope).to.deep.equal({
        attributes: {
          include: ['foobar'],
          exclude: ['createdAt'],
        },
      });
    });

    it('should be able to merge scopes with the same include', () => {
      const { Company, Project } = getModels();

      Company.addScope('project', {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }],
      });
      Company.addScope('alsoProject', {
        include: [{ model: Project, where: { something: true }, limit: 1 }],
      });
      expect(Company.withScope(['project', 'alsoProject'])._scope).to.deep.equal({
        include: [
          {
            model: Project,
            where: {
              [Op.and]: [{ something: false, somethingElse: 99 }, { something: true }],
            },
            association: Company.associations.projects,
            as: 'projects',
            limit: 1,
          },
        ],
      });
    });
  });

  describe('_injectScope', () => {
    it('should be able to merge scope and where', () => {
      const MyModel = sequelize.define('model');
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

      expect(options).to.deep.equal({
        where: {
          [Op.and]: [{ something: true, somethingElse: 42 }, { something: false }],
        },
        limit: 9,
        offset: 3,
      });
    });

    it('should be able to merge scope and having', () => {
      const MyModel = sequelize.define('model');
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

      expect(options).to.deep.equal({
        having: {
          [Op.and]: [{ something: true, somethingElse: 42 }, { something: false }],
        },
        limit: 9,
        offset: 3,
      });
    });

    it('should be able to merge scoped include', () => {
      const { Project } = getModels();

      const MyModel = sequelize.define('model');
      MyModel.hasMany(Project);

      MyModel.addScope('defaultScope', {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }],
      });

      const options = {
        include: [{ model: Project, where: { something: true }, limit: 1 }],
      };

      MyModel._conformIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options.include).to.deep.equal([
        {
          model: Project,
          where: {
            [Op.and]: [{ something: false, somethingElse: 99 }, { something: true }],
          },
          association: MyModel.associations.projects,
          as: 'projects',
          limit: 1,
        },
      ]);
    });

    it('should be able to merge aliased includes with the same model', () => {
      const { User } = getModels();

      const MyModel = sequelize.define('model');
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
      expect(options.include[0]).to.deep.equal({
        model: User,
        as: 'someUser',
        association: MyModel.associations.someUser,
      });
      expect(options.include[1]).to.deep.equal({
        model: User,
        as: 'otherUser',
        association: MyModel.associations.otherUser,
      });
    });

    it('should be able to merge scoped include with include in find', () => {
      const { Project, User } = getModels();

      const MyModel = sequelize.define('model');
      MyModel.hasMany(Project);
      MyModel.hasMany(User);

      MyModel.addScope('defaultScope', {
        include: [{ model: Project, where: { something: false } }],
      });

      const options = {
        include: [{ model: User, where: { something: true } }],
      };

      MyModel._normalizeIncludes(options, MyModel);
      MyModel._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({
        model: Project,
        as: 'projects',
        association: MyModel.associations.projects,
        where: { something: false },
      });
      expect(options.include[1]).to.deep.equal({
        model: User,
        as: 'users',
        association: MyModel.associations.users,
        where: { something: true },
      });
    });

    describe('include all', () => {
      it('scope with all', () => {
        const { User, Project } = getModels();

        const MyModel = sequelize.define('model');
        MyModel.hasMany(User);
        MyModel.hasMany(Project);
        MyModel.addScope('defaultScope', {
          include: [{ all: true }],
        });

        const options = {
          include: [{ model: User, where: { something: true } }],
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
        const { Project, User } = getModels();

        const MyModel = sequelize.define('model');
        MyModel.hasMany(User);
        MyModel.hasMany(Project);
        MyModel.addScope('defaultScope', {
          include: [{ model: User, where: { something: true } }],
        });

        const options = {
          include: [{ all: true }],
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
