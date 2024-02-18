import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('Model', () => {
  // TODO [>=8]: throw if an attribute has the same name as a built-in Model method.
  it('does not let attributes shadow built-in model method & properties', () => {
    const User = sequelize.define('OverWrittenKeys', {
      set: DataTypes.STRING,
    });

    const user = User.build({ set: 'A' });
    expect(user.get('set')).to.equal('A');
    user.set('set', 'B');
    expect(user.get('set')).to.equal('B');
  });

  it('makes attributes take priority over class properties defined on the model', () => {
    // Issue description: https://github.com/sequelize/sequelize/issues/14300
    // Sequelize models add getter & setters on the model prototype for all attributes defined on the model.
    // Class properties, which are usually used when using TypeScript or decorators, are added on the model instance,
    // and therefore take priority over the prototype getters & setters.
    // This test ensures that the attributes are not shadowed by the class properties.
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      id: CreationOptional<number> = 10;
      firstName: string = 'abc';
      nonAttribute: NonAttribute<string> = 'def';
    }

    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        firstName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      { sequelize },
    );

    const user = User.build({ firstName: 'Zoe' });

    expect(user.id).to.eq(null); // autoIncrement
    expect(user.firstName).to.eq('Zoe');
    expect(user.nonAttribute).to.eq('def');
  });

  it('makes associations take priority over class properties defined on the model', () => {
    // This is the same issue as above, but for associations
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      profile?: Profile;
    }

    class Profile extends Model<InferAttributes<Profile>, InferCreationAttributes<Profile>> {
      userId: number = 10;
    }

    User.init({}, { sequelize });
    Profile.init({}, { sequelize });

    User.hasOne(Profile, { as: 'profile', foreignKey: 'userId' });

    // @ts-expect-error -- TODO: add typing for creating associations in build/create
    const user = User.build({ profile: {} }, { include: ['profile'] });
    expect(user.profile).to.be.instanceof(Profile);
  });
});
