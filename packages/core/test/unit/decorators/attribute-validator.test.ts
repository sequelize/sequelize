import { expect } from 'chai';
import { Model, DataTypes } from '@sequelize/core';
import { ValidateAttribute, Attribute, IsLowercase } from '@sequelize/core/decorators-legacy';
import { sequelize } from '../../support';

describe('@ValidateAttribute legacy decorator', () => {
  it('can add an attribute validator', async () => {
    class User extends Model {
      @Attribute(DataTypes.STRING)
      @ValidateAttribute({
        myCustomValidator() {
          throw new Error('test error');
        },
      })
      declare name: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ name: 'test' });

    await expect(user.validate()).to.be.rejectedWith('test error');
  });

  it('is available as individual decorators', async () => {
    class User extends Model {
      @Attribute(DataTypes.STRING)
      @IsLowercase
      declare name: string;
    }

    sequelize.addModels([User]);

    const user = User.build({ name: 'ABC' });

    await expect(user.validate()).to.be.rejectedWith('Validation isLowercase on name failed');
  });
});
