import { DataTypes, Model } from '@sequelize/core';
import { Attribute, ValidateAttribute } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
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
});
