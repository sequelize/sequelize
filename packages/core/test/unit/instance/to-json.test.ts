import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Model#toJSON', () => {
  if (!dialect.supports.dataTypes.JSON) {
    return;
  }

  it('returns copy of json', () => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
    });
    const user = User.build({ name: 'my-name' });
    const json1 = user.toJSON();

    expect(json1).to.deep.equal({ id: null, name: 'my-name' });

    // remove value from json and ensure it's not changed in the instance
    delete json1.name;

    const json2 = user.toJSON();
    expect(json2).to.have.property('name').and.be.equal('my-name');
  });

  it('returns clone of JSON data-types', () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare name: string;
      declare permissions: {
        admin: boolean;
        special: string;
      };
    }

    User.init(
      {
        name: DataTypes.STRING,
        permissions: DataTypes.JSON,
      },
      { sequelize },
    );

    const user = User.build({ name: 'my-name', permissions: { admin: true, special: 'foobar' } });
    const json = user.toJSON();

    expect(json).to.deep.equal({
      id: null,
      name: 'my-name',
      permissions: { admin: true, special: 'foobar' },
    });

    expect(json.permissions).not.to.equal(user.permissions);
    json.permissions.admin = false;
    expect(user.permissions.admin).to.equal(true);
  });
});
