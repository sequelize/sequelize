import type { FindOptions, Includeable, Model, ModelStatic } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { beforeEach2, sequelize } from '../support';

type QueryOptions = Pick<FindOptions, 'minifyAliases' | 'subQuery'>;

async function findUserIds(
  User: ModelStatic<Model>,
  include: Includeable[],
  options: QueryOptions = {},
): Promise<unknown[]> {
  const users = await User.findAll({
    attributes: ['id'],
    include,
    limit: 10,
    order: [['id', 'ASC']],
    ...options,
  });

  return users.map(user => user.get('id'));
}

describe('Include', () => {
  const vars = beforeEach2(async () => {
    const User = sequelize.define(
      'User',
      {
        uuid: {
          type: DataTypes.STRING,
          unique: true,
          columnName: 'user_uuid',
        },
      },
      { timestamps: false },
    );
    const Tag = sequelize.define('Tag', {}, { timestamps: false });
    const parent = User.belongsTo(User, {
      as: 'parent',
      foreignKey: 'parentId',
    });
    const tags = User.belongsToMany(Tag, {
      through: 'UserTags',
      sourceKey: 'uuid',
    });

    await sequelize.sync({ force: true });

    const user = await User.create({ uuid: 'user-1' });
    const child = await User.create({ uuid: 'user-2' });
    const tag = await Tag.create();
    await parent.set(child, user);
    await tags.add(user, tag);

    const include: Includeable[] = [
      {
        association: tags,
        attributes: [],
        through: { attributes: [] },
        required: true,
      },
    ];

    const nestedInclude: Includeable[] = [
      {
        association: parent,
        attributes: [],
        required: true,
        subQuery: false,
        include: [
          {
            association: tags,
            attributes: [],
            through: { attributes: [] },
            required: true,
          },
        ],
      },
    ];

    return {
      User,
      include,
      nestedInclude,
      expectedIds: [user.get('id')],
      expectedNestedIds: [child.get('id')],
    };
  });

  it('uses the sourceKey with subQuery false', async () => {
    const ids = await findUserIds(vars.User, vars.include, { subQuery: false });

    expect(ids).to.deep.equal(vars.expectedIds);
  });

  it('keeps the sourceKey available with subQuery true', async () => {
    const ids = await findUserIds(vars.User, vars.include, { subQuery: true });

    expect(ids).to.deep.equal(vars.expectedIds);
  });

  it('keeps the sourceKey available when the subquery is selected automatically', async () => {
    const ids = await findUserIds(vars.User, vars.include);

    expect(ids).to.deep.equal(vars.expectedIds);
  });

  it('keeps the sourceKey available when aliases are minified', async () => {
    const ids = await findUserIds(vars.User, vars.include, {
      subQuery: true,
      minifyAliases: true,
    });

    expect(ids).to.deep.equal(vars.expectedIds);
  });

  it('uses the sourceKey column for a nested self-association', async () => {
    const ids = await findUserIds(vars.User, vars.nestedInclude, { subQuery: true });

    expect(ids).to.deep.equal(vars.expectedNestedIds);
  });
});
