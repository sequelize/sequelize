import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, sequelize } from '../../support';

describe('Model#equals()', () => {
  const vars = beforeAll2(() => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare username: string;
    }

    class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
      declare title: string;
    }

    User.init({ username: DataTypes.STRING }, { sequelize });
    Project.init({ title: DataTypes.STRING }, { sequelize });

    return { User, Project };
  });

  it('returns true when comparing an instance to itself', () => {
    const user = vars.User.build({ id: 1, username: 'alice' });
    expect(user.equals(user)).to.be.true;
  });

  it('returns true when two instances of the same model share the same primary key', () => {
    const user1 = vars.User.build({ id: 1, username: 'alice' });
    const user2 = vars.User.build({ id: 1, username: 'alice' });
    expect(user1.equals(user2)).to.be.true;
  });

  it('returns false when two instances of the same model have different primary keys', () => {
    const user1 = vars.User.build({ id: 1, username: 'alice' });
    const user2 = vars.User.build({ id: 2, username: 'alice' });
    expect(user1.equals(user2)).to.be.false;
  });

  it('returns false when comparing instances of different models, even with the same primary key', () => {
    const user = vars.User.build({ id: 1 });
    const project = vars.Project.build({ id: 1 });
    expect((user as Model).equals(project)).to.be.false;
  });

  it('returns false when comparing to a non-Model value', () => {
    const user = vars.User.build({ id: 1 });
    expect(user.equals(null as unknown as Model)).to.be.false;
    expect(user.equals(undefined as unknown as Model)).to.be.false;
    expect(user.equals({ id: 1 } as unknown as Model)).to.be.false;
  });
});
