import type { ModelStatic } from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import { expect } from 'chai';
import { beforeEach2, sequelize } from '../../support';

// _conformIncludes and _expandIncludeAll are internal static methods of Model that are not part of its public typings
type ModelInternals = {
  _conformIncludes(options: object, associationOwner: ModelStatic): void;
  _expandIncludeAll(options: object, associationOwner: ModelStatic): void;
};

describe('Model._expandIncludeAll', () => {
  it('can expand nested self-reference', () => {
    const Referral = sequelize.define('referral');

    Referral.belongsTo(Referral);

    const options = { include: [{ all: true, nested: true }] };

    (Referral as typeof Referral & ModelInternals)._expandIncludeAll(options, Referral);

    expect(options.include).to.deep.equal([
      { as: 'referral', model: Referral, association: Referral.associations.referral },
    ]);
  });
});

describe('_validateIncludedElements', () => {
  const vars = beforeEach2(() => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task', {
      title: DataTypes.STRING,
    });
    const Company = sequelize.define('Company', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'field_id',
      },
      name: DataTypes.STRING,
    });

    const userTasks = User.hasMany(Task);
    const userCompany = User.belongsTo(Company);
    const companyEmployees = Company.hasMany(User);
    const companyOwner = Company.belongsTo(User, {
      as: 'Owner',
      foreignKey: 'ownerId',
    });

    return { User, Task, Company, userTasks, userCompany, companyEmployees, companyOwner };
  });

  describe('attributes', () => {
    it("should not inject the aliased PK again, if it's already there", () => {
      let options = _validateIncludedElements({
        model: vars.User,
        include: [
          {
            model: vars.Company,
            attributes: ['name'],
          },
        ],
      });

      expect(options.include[0].attributes).to.deep.equal([['field_id', 'id'], 'name']);

      options = _validateIncludedElements(options);

      // Calling validate again shouldn't add the pk again
      expect(options.include[0].attributes).to.deep.equal([['field_id', 'id'], 'name']);
    });

    describe('include / exclude', () => {
      it('allows me to include additional attributes', () => {
        const options = _validateIncludedElements({
          model: vars.User,
          include: [
            {
              model: vars.Company,
              attributes: {
                include: ['foobar'],
              },
            },
          ],
        });

        expect(options.include[0].attributes).to.deep.equal([
          ['field_id', 'id'],
          'name',
          'createdAt',
          'updatedAt',
          'ownerId',
          'foobar',
        ]);
      });

      it('allows me to exclude attributes', () => {
        const options = _validateIncludedElements({
          model: vars.User,
          include: [
            {
              model: vars.Company,
              attributes: {
                exclude: ['name'],
              },
            },
          ],
        });

        expect(options.include[0].attributes).to.deep.equal([
          ['field_id', 'id'],
          'createdAt',
          'updatedAt',
          'ownerId',
        ]);
      });

      it('include takes precendence over exclude', () => {
        const options = _validateIncludedElements({
          model: vars.User,
          include: [
            {
              model: vars.Company,
              attributes: {
                exclude: ['name'],
                include: ['name'],
              },
            },
          ],
        });

        expect(options.include[0].attributes).to.deep.equal([
          ['field_id', 'id'],
          'createdAt',
          'updatedAt',
          'ownerId',
          'name',
        ]);
      });
    });
  });

  describe('scope', () => {
    const scopeVars = beforeEach2(() => {
      const Project = sequelize.define(
        'project',
        {
          bar: {
            type: DataTypes.STRING,
            field: 'foo',
          },
        },
        {
          defaultScope: {
            where: {
              active: true,
            },
          },
          scopes: {
            this: {
              where: { this: true },
            },
            that: {
              where: { that: false },
              limit: 12,
            },
            attr: {
              attributes: ['baz'],
            },
            foobar: {
              where: {
                bar: 42,
              },
            },
          },
        },
      );

      vars.User.hasMany(Project);

      vars.User.hasMany(Project.withScope('this'), { as: 'thisProject' });

      return { Project };
    });

    it('adds the default scope to where', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ model: scopeVars.Project, as: 'projects' }],
      });

      expect(options.include[0]).to.have.property('where').which.deep.equals({ active: true });
    });

    it('adds the where from a scoped model', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ model: scopeVars.Project.withScope('that'), as: 'projects' }],
      });

      expect(options.include[0]).to.have.property('where').which.deep.equals({ that: false });
      expect(options.include[0]).to.have.property('limit').which.equals(12);
    });

    it('adds the attributes from a scoped model', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ model: scopeVars.Project.withScope('attr'), as: 'projects' }],
      });

      expect(options.include[0]).to.have.property('attributes').which.deep.equals(['baz']);
    });

    it('merges where with the where from a scoped model', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          {
            where: { active: false },
            model: scopeVars.Project.withScope('that'),
            as: 'projects',
          },
        ],
      });

      expect(options.include[0].where).to.deep.equal({
        [Op.and]: [{ that: false }, { active: false }],
      });
    });

    it('add the where from a scoped associated model', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ model: scopeVars.Project, as: 'thisProject' }],
      });

      expect(options.include[0]).to.have.property('where').which.deep.equals({ this: true });
    });

    it('handles a scope with an aliased column (.field)', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ model: scopeVars.Project.withScope('foobar'), as: 'projects' }],
      });

      expect(options.include[0]).to.have.property('where').which.deep.equals({ bar: 42 });
    });
  });

  describe('duplicating', () => {
    it('should tag a hasMany association as duplicating: true if undefined', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [vars.userTasks],
      });

      expect(options.include[0].duplicating).to.equal(true);
    });

    it('should respect include.duplicating for a hasMany', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ association: vars.userTasks, duplicating: false }],
      });

      expect(options.include[0].duplicating).to.equal(false);
    });
  });

  describe('_conformInclude', () => {
    it('should expand association from string alias', () => {
      const options = {
        include: ['Owner'],
      };
      (Model as typeof Model & ModelInternals)._conformIncludes(options, vars.Company);

      expect(options.include[0]).to.deep.equal({
        model: vars.User,
        association: vars.companyOwner,
        as: 'Owner',
      });
    });

    it('should expand string association', () => {
      const options = {
        include: [
          {
            association: 'Owner',
            attributes: ['id'],
          },
        ],
      };
      (Model as typeof Model & ModelInternals)._conformIncludes(options, vars.Company);

      expect(options.include[0]).to.deep.equal({
        model: vars.User,
        association: vars.companyOwner,
        attributes: ['id'],
        as: 'Owner',
      });
    });

    it('should throw an error if invalid model is passed', () => {
      const options = {
        include: [
          {
            model: null,
          },
        ],
      };

      expect(() => {
        (Model as typeof Model & ModelInternals)._conformIncludes(options, vars.Company);
      }).to.throw(
        'Invalid Include received. Include has to be either a Model, an Association, the name of an association, or a plain object compatible with IncludeOptions.',
      );
    });

    it('should throw an error if invalid association is passed', () => {
      const options = {
        include: [
          {
            association: null,
          },
        ],
      };

      expect(() => {
        (Model as typeof Model & ModelInternals)._conformIncludes(options, vars.Company);
      }).to.throw(
        'Invalid Include received. Include has to be either a Model, an Association, the name of an association, or a plain object compatible with IncludeOptions.',
      );
    });
  });

  describe('getAssociationWithModel', () => {
    it('returns an association when there is a single unaliased association', () => {
      // @ts-expect-error -- the typings require the alias, but it is optional at runtime when there is a single association
      expect(vars.User.getAssociationWithModel(vars.Task)).to.equal(vars.userTasks);
    });

    it('returns an association when there is a single aliased association', () => {
      const User = sequelize.define('User');
      const Task = sequelize.define('Task');
      const Tasks = Task.belongsTo(User, { as: 'owner' });
      expect(Task.getAssociationWithModel(User, 'owner')).to.equal(Tasks);
    });

    it('returns an association when there are multiple aliased associations', () => {
      expect(vars.Company.getAssociationWithModel(vars.User, 'Owner')).to.equal(vars.companyOwner);
    });
  });

  describe('subQuery', () => {
    it('should be true if theres a duplicating association', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ association: vars.userTasks }],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
    });

    it('should be false if theres a duplicating association but no limit', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ association: vars.userTasks }],
        limit: null,
      });

      expect(options.subQuery).to.equal(false);
    });

    it('should be true if theres a nested duplicating association', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          {
            association: vars.userCompany,
            include: [vars.companyEmployees],
          },
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
    });

    it('should be false if theres a nested duplicating association but no limit', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          {
            association: vars.userCompany,
            include: [vars.companyEmployees],
          },
        ],
        limit: null,
      });

      expect(options.subQuery).to.equal(false);
    });

    it('should tag a required hasMany association', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ association: vars.userTasks, required: true }],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
      expect(options.include[0].subQuery).to.equal(false);
      expect(options.include[0].subQueryFilter).to.equal(true);
    });

    it('should not tag a required hasMany association with duplicating false', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ association: vars.userTasks, required: true, duplicating: false }],
        limit: 3,
      });

      expect(options.subQuery).to.equal(false);
      expect(options.include[0].subQuery).to.equal(false);
      expect(options.include[0].subQueryFilter).to.equal(false);
    });

    it('should not tag a separate hasMany association with subQuery true', () => {
      const options = _validateIncludedElements({
        model: vars.Company,
        include: [
          {
            association: vars.companyEmployees,
            separate: true,
            include: [{ association: vars.userTasks, required: true }],
          },
        ],
        required: true,
      });

      expect(options.subQuery).to.equal(false);
      expect(options.include[0].subQuery).to.equal(false);
      expect(options.include[0].subQueryFilter).to.equal(false);
    });

    it('should tag a hasMany association with where', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [{ association: vars.userTasks, where: { title: Math.random().toString() } }],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
      expect(options.include[0].subQuery).to.equal(false);
      expect(options.include[0].subQueryFilter).to.equal(true);
    });

    it('should not tag a hasMany association with where and duplicating false', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          {
            association: vars.userTasks,
            where: { title: Math.random().toString() },
            duplicating: false,
          },
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(false);
      expect(options.include[0].subQuery).to.equal(false);
      expect(options.include[0].subQueryFilter).to.equal(false);
    });

    it('should tag a required belongsTo alongside a duplicating association', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          { association: vars.userCompany, required: true },
          { association: vars.userTasks },
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
      expect(options.include[0].subQuery).to.equal(true);
    });

    it('should not tag a required belongsTo alongside a duplicating association with duplicating false', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          { association: vars.userCompany, required: true },
          { association: vars.userTasks, duplicating: false },
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(false);
      expect(options.include[0].subQuery).to.equal(false);
    });

    it('should tag a belongsTo association with where alongside a duplicating association', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          { association: vars.userCompany, where: { name: Math.random().toString() } },
          { association: vars.userTasks },
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
      expect(options.include[0].subQuery).to.equal(true);
    });

    it('should tag a required belongsTo association alongside a duplicating association with a nested belongsTo', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          {
            association: vars.userCompany,
            required: true,
            include: [vars.companyOwner],
          },
          vars.userTasks,
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(true);
      expect(options.include[0].subQuery).to.equal(true);
      expect(options.include[0].include[0].subQuery).to.equal(false);
      expect(options.include[0].include[0].parent.subQuery).to.equal(true);
    });

    it('should tag a belongsTo association with where alongside a duplicating association with duplicating false', () => {
      const options = _validateIncludedElements({
        model: vars.User,
        include: [
          { association: vars.userCompany, where: { name: Math.random().toString() } },
          { association: vars.userTasks, duplicating: false },
        ],
        limit: 3,
      });

      expect(options.subQuery).to.equal(false);
      expect(options.include[0].subQuery).to.equal(false);
    });
  });
});
