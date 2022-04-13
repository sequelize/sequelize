import assert from 'assert';
import { DataTypes, Op, Sequelize, col, where } from '@sequelize/core';
// eslint-disable-next-line import/order
import { expect } from 'chai';

const Support = require('../support');

const sequelize = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  const Project = sequelize.define('project');
  const User = sequelize.define('user');

  const scopes = {
    complexFunction(value: any) {
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
      where: where(col('a'), 1),
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
    actualValue(value: any) {
      return {
        where: {
          other_value: value,
        },
      };
    },
  };

  const Company = sequelize.define('company', {}, {
    defaultScope: {
      include: [Project],
      where: { active: true },
    },
    scopes,
  });

  describe('withScope', () => {
    describe('attribute exclude / include', () => {
      const User2 = sequelize.define('user', {
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

      it('should not expand attributes', () => {
        expect(User2._scope.attributes).to.deep.equal({ exclude: ['password'] });
      });

      it('should not expand attributes', () => {
        expect(User2.withScope('aScope')._scope.attributes).to.deep.equal({ exclude: ['value'] });
      });

      it('should unite attributes with array', () => {
        expect(User2.withScope('aScope', 'defaultScope')._scope.attributes).to.deep.equal({ exclude: ['value', 'password'] });
      });

      it('should not modify the original scopes when merging them', () => {
        expect(User2.withScope('defaultScope', 'aScope').options.defaultScope.attributes).to.deep.equal({ exclude: ['password'] });
      });
    });

    it('defaultScope should be an empty object if not overridden', () => {
      const Foo = sequelize.define('foo', {}, {});

      expect(Foo.withScope('defaultScope')._scope).to.deep.equal({});
    });

    it('should apply default scope', () => {
      expect(Company._scope).to.deep.equal({
        include: [Project],
        where: { active: true },
      });
    });

    it('should be able to merge scopes', () => {
      expect(Company.withScope('somethingTrue', 'somethingFalse', 'sequelizeWhere')._scope).to.deepEqual({
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
      const scoped1 = Company.withScope('somethingTrue');
      const scoped2 = Company.withScope('somethingFalse');

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
      expect(Company.withScope({ method: ['actualValue', 11] })._scope).to.deepEqual({
        where: {
          other_value: 11,
        },
      });

      expect(Company.withScope('noArgs')._scope).to.deepEqual({
        where: {
          other_value: 7,
        },
      });
    });

    it('should work with consecutive function scopes', () => {
      const scope = { method: ['actualValue', 11] };
      expect(Company.withScope(scope)._scope).to.deepEqual({
        where: {
          other_value: 11,
        },
      });

      expect(Company.withScope(scope)._scope).to.deepEqual({
        where: {
          other_value: 11,
        },
      });
    });

    it('should be able to check default scope name', () => {
      expect(Company._scopeNames).to.include('defaultScope');
    });

    it('should be able to check custom scope name', () => {
      expect(Company.withScope('users')._scopeNames).to.include('users');
    });

    it('should be able to check multiple custom scope names', () => {
      expect(Company.withScope('users', 'projects')._scopeNames).to.include.members(['users', 'projects']);
    });

    it('should be able to merge two scoped includes', () => {
      expect(Company.withScope('users', 'projects')._scope).to.deep.equal({
        include: [
          { model: User },
          { model: Project },
        ],
      });
    });

    it('should be able to keep original scope definition clean', () => {
      expect(Company.withScope('projects', 'users', 'alsoUsers')._scope).to.deepEqual({
        include: [
          { model: Project },
          { model: User, where: { something: 42 } },
        ],
      });

      expect(Company.options.scopes.alsoUsers).to.deepEqual({
        include: [
          { model: User, where: { something: 42 } },
        ],
      });

      expect(Company.options.scopes.users).to.deepEqual({
        include: [
          { model: User },
        ],
      });
    });

    it('should be able to override the default scope', () => {
      expect(Company.withScope('somethingTrue')._scope).to.deepEqual({
        where: {
          something: true,
          somethingElse: 42,
        },
        limit: 5,
      });
    });

    it('should be able to combine default with another scope', () => {
      expect(Company.withScope(['defaultScope', { method: ['actualValue', 11] }])._scope).to.deepEqual({
        include: [{ model: Project }],
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
          where: where(col('field'), Op.is, 1),
        },
        whereSequelizeWhere2: {
          where: where(col('field'), Op.is, 2),
        },
      };

      const TestModel = sequelize.define('testModel', {}, {
        mergeWhereScopesWithAndOperator: true,
        scopes: testModelScopes,
      });

      describe('attributes', () => {
        it('should group 2 similar attributes with an Op.and', () => {
          const scope = TestModel.withScope(['whereAttributeIs1', 'whereAttributeIs2'])._scope;
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
          const scope = TestModel.withScope(['whereAttributeIs1', 'whereAttributeIs2', 'whereAttributeIs3'])._scope;
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
          const scope = TestModel.withScope(['whereAttributeIs1', 'whereOtherAttributeIs4'])._scope;
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
          const scope = TestModel.withScope(['whereOpAnd1', 'whereOpAnd2'])._scope;
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
          expect(scope).to.deepEqual(expected);
        });
      });

      describe('or operators', () => {
        it('should group 2 Op.or with an Op.and', () => {
          const scope = TestModel.withScope(['whereOpOr1', 'whereOpOr2'])._scope;
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
          expect(scope).to.deepEqual(expected);
        });

        it('should group multiple Op.or and Op.and with an unique Op.and', () => {
          const scope = TestModel.withScope(['whereOpOr1', 'whereOpOr2', 'whereOpAnd1', 'whereOpAnd2'])._scope;
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
          const scope = TestModel.withScope(['whereOpAnd1', 'whereOpAnd2', 'whereOpOr1', 'whereOpOr2'])._scope;
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
          const scope = TestModel.withScope(['whereSequelizeWhere1', 'whereSequelizeWhere2'])._scope;
          const expected = {
            where: {
              [Op.and]: [
                where(col('field'), Op.is, 1),
                where(col('field'), Op.is, 2),
              ],
            },
          };
          expect(scope).to.deepEqual(expected);
        });

        it('should group 2 sequelize.where and other scopes with an Op.and', () => {
          const scope = TestModel.withScope(['whereAttributeIs1', 'whereOpAnd1', 'whereOpOr1', 'whereSequelizeWhere1'])._scope;
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
          expect(scope).to.deepEqual(expected);
        });
      });
    });

    it('should be able to use raw queries', () => {
      expect(Company.withScope([{ method: ['complexFunction', 'qux'] }])._scope).to.deepEqual({
        where: ['qux IN (SELECT foobar FROM some_sql_function(foo.bar))'],
      });
    });

    it('should override the default scope', () => {
      expect(Company.withScope(['defaultScope', { method: ['complexFunction', 'qux'] }])._scope).to.deepEqual({
        include: [{ model: Project }],
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
        Company.withScope('doesntexist');
      }).to.throw('"company.withScope()" has been called with an invalid scope: "doesntexist" does not exist.');
    });

    it('should concatenate scope groups', () => {
      expect(Company.withScope('groupByCompanyId', 'groupByProjectId')._scope).to.deep.equal({
        group: ['company.id', 'project.id'],
        include: [{ model: Project }],
      });
    });
  });

  describe('withoutScope', () => {
    it('returns a model with no scope (including the default scope)', () => {
      expect(Company.withScope(null)._scope).to.be.empty;
      expect(Company.withoutScope()._scope).to.be.empty;
      // Yes, being unscoped is also a scope - this prevents inject defaultScope, when including a scoped model, see #4663
      expect(Company.withoutScope().scoped).to.be.true;
    });

    it('returns the same model no matter which variant it was called on', () => {
      assert(Company.withoutScope() === Company.withScope('somethingTrue').withoutScope());
    });

    it('returns the same model if used with schema', () => {
      assert(Company.withSchema('schema1').withoutScope() === Company.withoutScope().withSchema('schema1'));
    });
  });

  describe('withInitialScope', () => {
    it('returns the initial model if no schema is defined', () => {
      assert(Company.withScope('somethingTrue').withInitialScope() === Company);
    });

    it('returns the a model with just the schema if one was defined is defined', () => {
      assert(Company.withSchema('schema1').withInitialScope() === Company.withInitialScope().withSchema('schema1'));
    });
  });

  describe('addScope', () => {
    it('works if the model does not have any initial scopes', () => {
      const Model = sequelize.define('model');

      expect(() => {
        Model.addScope('anything', {});
      }).not.to.throw();
    });

    it('allows me to add a new scope', () => {
      expect(() => {
        Company.withScope('newScope');
      }).to.throw('"company.withScope()" has been called with an invalid scope: "newScope" does not exist.');

      Company.addScope('newScope', {
        where: {
          this: 'that',
        },
        include: [{ model: Project }],
      });

      expect(Company.withScope('newScope')._scope).to.deepEqual({
        where: {
          this: 'that',
        },
        include: [{ model: Project }],
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

      expect(Company.withScope('somethingTrue')._scope).to.deepEqual({
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
      const Model = sequelize.define('model');

      expect(() => {
        Model.addScope('defaultScope', {});
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

      expect(Company.withScope('newIncludeScope')._scope).to.deep.equal({
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
      expect(Company.withScope(['project', 'alsoProject'])._scope).to.deepEqual({
        include: [{
          model: Project,
          where: {
            [Op.and]: [
              { something: false, somethingElse: 99 },
              { something: true },
            ],
          },
          limit: 1,
        }],
      });
    });
  });

  describe('_injectScope', () => {
    const Model = sequelize.define('model');

    it('should be able to merge scope and where', () => {
      Model._scope = {
        where: { something: true, somethingElse: 42 },
        limit: 15,
        offset: 3,
      };

      const options = {
        where: {
          something: false,
        },
        limit: 9,
      };

      Model._injectScope(options);

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
      Model._scope = {
        having: { something: true, somethingElse: 42 },
        limit: 15,
        offset: 3,
      };

      const options = {
        having: {
          something: false,
        },
        limit: 9,
      };

      Model._injectScope(options);

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

    it('should be able to merge scopes with the same include', () => {
      Model._scope = {
        include: [
          { model: Project, where: { something: false, somethingElse: 99 } },
          { model: Project, where: { something: true }, limit: 1 },
        ],
      };

      const options = {};

      Model._injectScope(options);

      // @ts-expect-error
      expect(options.include).to.have.length(1);
      // @ts-expect-error
      expect(options.include[0]).to.deepEqual({
        model: Project,
        where: {
          [Op.and]: [
            { something: false, somethingElse: 99 },
            { something: true },
          ],
        },
        limit: 1,
      });
    });

    it('should be able to merge scoped include', () => {
      Model._scope = {
        include: [{ model: Project, where: { something: false, somethingElse: 99 } }],
      };

      const options = {
        include: [{ model: Project, where: { something: true }, limit: 1 }],
      };

      Model._injectScope(options);

      expect(options.include).to.have.length(1);
      expect(options.include[0]).to.deepEqual({
        model: Project,
        where: {
          [Op.and]: [
            { something: false, somethingElse: 99 },
            { something: true },
          ],
        },
        limit: 1,
      });
    });

    it('should be able to merge aliased includes with the same model', () => {
      Model._scope = {
        include: [{ model: User, as: 'someUser' }],
      };

      const options = {
        include: [{ model: User, as: 'otherUser' }],
      };

      Model._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({ model: User, as: 'someUser' });
      expect(options.include[1]).to.deep.equal({ model: User, as: 'otherUser' });
    });

    it('should be able to merge scoped include with include in find', () => {
      Model._scope = {
        include: [
          { model: Project, where: { something: false } },
        ],
      };

      const options = {
        include: [
          { model: User, where: { something: true } },
        ],
      };

      Model._injectScope(options);

      expect(options.include).to.have.length(2);
      expect(options.include[0]).to.deep.equal({ model: Project, where: { something: false } });
      expect(options.include[1]).to.deep.equal({ model: User, where: { something: true } });
    });

    describe('include all', () => {
      it('scope with all', () => {
        Model._scope = {
          include: [
            { all: true },
          ],
        };

        const options = {
          include: [
            { model: User, where: { something: true } },
          ],
        };

        Model._injectScope(options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({ all: true });
        expect(options.include[1]).to.deep.equal({ model: User, where: { something: true } });
      });

      it('options with all', () => {
        Model._scope = {
          include: [
            { model: User, where: { something: true } },
          ],
        };

        const options = {
          include: [
            { all: true },
          ],
        };

        Model._injectScope(options);

        expect(options.include).to.have.length(2);
        expect(options.include[0]).to.deep.equal({ model: User, where: { something: true } });
        expect(options.include[1]).to.deep.equal({ all: true });
      });
    });
  });
});
