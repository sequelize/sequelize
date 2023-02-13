import { DataTypes, Model, Sequelize } from '@sequelize/core';
import { Attribute } from '@sequelize/core/decorators-legacy';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { IsLowercase } from '@sequelize/validator.js';

chai.use(chaiAsPromised);

describe('@IsLowercase legacy decorator', () => {
  it('validates that the attribute is lowercase', async () => {
    class User extends Model {
      @Attribute(DataTypes.STRING)
      @IsLowercase
      declare name: string;
    }

    new Sequelize('sqlite::memory:', {
      models: [User],
    });

    const user = User.build({ name: 'ABC' });

    await expect(user.validate()).to.be.rejectedWith('Validation isLowercase on name failed');
  });
});
