import type {
  BelongsToManyAddAssociationMixin,
  CreationOptional,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, beforeEach2, sequelize, setResetMode } from '../support';

// This test suite ensures DataType methods are called at the appropriate time

const dialect = sequelize.dialect;

describe('DataType Methods', () => {
  setResetMode('none');

  const customValueSymbol = Symbol('dummy');

  class CustomDataType extends DataTypes.STRING {
    parseDatabaseValue(_value: unknown): any {
      return customValueSymbol;
    }
  }

  const models = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;
      declare name: string | null;
      declare projects?: NonAttribute<Project[]>;
    }

    User.init(
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: CustomDataType, allowNull: true, field: 'first_name' },
      },
      { sequelize },
    );

    class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
      declare name: string;
      declare userId: ForeignKey<number>;
      declare stakeholders?: NonAttribute<Array<User & { ProjectStakeholder: ProjectStakeholder }>>;

      declare addStakeholder: BelongsToManyAddAssociationMixin<User, User['id']>;
    }

    Project.init(
      {
        name: { type: CustomDataType, allowNull: false },
      },
      { sequelize },
    );

    class ProjectStakeholder extends Model<
      InferAttributes<ProjectStakeholder>,
      InferCreationAttributes<ProjectStakeholder>
    > {
      declare key: string;
    }

    ProjectStakeholder.init(
      {
        key: { type: CustomDataType, allowNull: false },
      },
      { sequelize, noPrimaryKey: true, timestamps: false },
    );

    Project.belongsTo(User, {
      as: 'user',
      inverse: { as: 'projects', type: 'hasMany' },
      foreignKey: 'userId',
    });

    Project.belongsToMany(User, {
      as: 'stakeholders',
      inverse: 'stakeholdings',
      through: ProjectStakeholder,
    });

    await User.sync({ force: true });
    await Project.sync({ force: true });
    await ProjectStakeholder.sync({ force: true });

    const user1 = await User.create({ name: 'John' });
    const user2 = await User.create({ name: 'Stakeholder User' });
    const project = await Project.create({ name: 'Project 1', userId: user1.id });
    await project.addStakeholder(user2, { through: { key: 'dummy-value' } });

    return { User, Project, ProjectStakeholder };
  });

  const spies = beforeEach2(() => {
    // add mocha spy to sanitize
    return {
      sanitize: sinon.spy(DataTypes.STRING.prototype, 'sanitize'),
      validate: sinon.spy(DataTypes.STRING.prototype, 'validate'),
      parseDatabaseValue: sinon.spy(CustomDataType.prototype, 'parseDatabaseValue'),
    };
  });

  afterEach(() => {
    for (const spy of Object.values(spies)) {
      spy.restore();
    }
  });

  it(`setting a value on a model only calls 'sanitize'`, () => {
    models.User.build({ name: 'foo' });

    expect(spies.sanitize.calledOnce).to.eq(true, 'sanitized not called exactly once');
    expect(spies.validate.called).to.eq(false, 'validate should not have been called');
    expect(spies.parseDatabaseValue.called).to.eq(
      false,
      'parseDatabaseValue should not have been called',
    );
  });

  it(`retrieving a model only calls 'parseDatabaseValue' (no join)`, async () => {
    const out = await models.User.findOne({ rejectOnEmpty: true });

    expect(out.name).to.eq(customValueSymbol, 'parseDatabaseValue not called on top level model');

    expect(spies.sanitize.called).to.eq(false, 'sanitize should not have been called');
    expect(spies.validate.called).to.eq(false, 'validate should not have been called');
  });

  it(`retrieving a model only calls 'parseDatabaseValue' (with join)`, async () => {
    // this test is separate from the no-join version because they use different code paths.
    // We test both double nested associations & that through tables are handled correctly.
    const out = await models.User.findOne({
      include: [
        {
          association: 'projects',
          include: ['stakeholders'],
        },
      ],
      rejectOnEmpty: true,
    });

    expect(out.name).to.eq(customValueSymbol, 'parseDatabaseValue not called on top level model');
    expect(out.projects![0].name).to.eq(
      customValueSymbol,
      'parseDatabaseValue not called on first include level',
    );
    expect(out.projects![0].stakeholders![0].name).to.eq(
      customValueSymbol,
      'parseDatabaseValue not called on second include level',
    );
    expect(out.projects![0].stakeholders![0].ProjectStakeholder.key).to.eq(
      customValueSymbol,
      'parseDatabaseValue not called on Many-To-Many through table',
    );

    expect(spies.sanitize.called).to.eq(false, 'sanitize should not have been called');
    expect(spies.validate.called).to.eq(false, 'validate should not have been called');
  });

  if (dialect.supports.returnValues) {
    it(`inserting a model calls 'parseDatabaseValue' on returned values`, async () => {
      // 'name' attr has a different name in the database
      const out = await models.User.create({ name: 'foo' }, { returning: true });

      expect(out.name).to.eq(customValueSymbol, 'parseDatabaseValue has not been called');

      // sanitize is called when the user input is added to the model
      expect(spies.sanitize.called).to.eq(true, 'sanitize should have been called');
      // validate is called before persisting the model
      expect(spies.validate.called).to.eq(true, 'validate should have been called');
    });

    it(`upserting a model calls 'parseDatabaseValue' on returned values`, async () => {
      if (!dialect.supports.upserts) {
        return;
      }

      // 'name' attr has a different name in the database
      const [out] = await models.User.upsert({ name: 'foo', id: 1234 }, { returning: true });

      expect(out.name).to.eq(customValueSymbol, 'parseDatabaseValue has not been called');

      // sanitize is called when the user input is added to the model
      expect(spies.sanitize.called).to.eq(true, 'sanitize should have been called');
      // validate is called before persisting the model
      expect(spies.validate.called).to.eq(true, 'validate should have been called');
    });
  }

  if (dialect.supports.returnValues === 'returning') {
    it(`updating a model calls 'parseDatabaseValue' on returned values`, async () => {
      const user = await models.User.create({ name: 'foo' });
      user.name = 'bob';
      await user.save({ returning: true });

      expect(user.name).to.eq(customValueSymbol, 'parseDatabaseValue has not been called');
    });

    // TODO: add test for 'returning' on DELETE queries once https://github.com/sequelize/sequelize/pull/14879 has been merged
  }

  it(`does not call 'parseDatabaseValue' on null values`, async () => {
    const user = await models.User.create({ name: null });
    await user.reload();

    expect(user.name).to.eq(null, 'parseDatabaseValue called on null value');
    expect(spies.parseDatabaseValue.called).to.eq(
      false,
      'parseDatabaseValue should not have been called',
    );
  });
});
