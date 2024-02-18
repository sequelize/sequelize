import { Model } from '@sequelize/core';
import { ModelValidator } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('@ModelValidator legacy decorator', () => {
  it('can add instance validators', async () => {
    let receivedThis: any;

    class User extends Model {
      @ModelValidator
      userValidator(): void {
        // eslint-disable-next-line consistent-this,unicorn/no-this-assignment -- testing which value is passed as "this"
        receivedThis = this;

        throw new Error('test error');
      }
    }

    sequelize.addModels([User]);

    const user = User.build();

    await expect(user.validate()).to.be.rejectedWith('test error');
    expect(receivedThis).to.equal(user);
  });

  it('can add static validators', async () => {
    let receivedThis: any;
    let receivedParameters: any;

    class User extends Model {
      @ModelValidator
      static userValidator(...parameters: unknown[]): void {
        // eslint-disable-next-line consistent-this,unicorn/no-this-assignment -- testing which value is passed as "this"
        receivedThis = this;
        receivedParameters = parameters;

        throw new Error('test error');
      }
    }

    sequelize.addModels([User]);

    const user = User.build();

    await expect(user.validate()).to.be.rejectedWith('test error');
    expect(receivedThis).to.equal(User);
    expect(receivedParameters).to.have.length(1);
    expect(receivedParameters[0]).to.eq(user);
  });

  it('supports symbol properties', async () => {
    const staticKey = Symbol('staticKey');
    const instanceKey = Symbol('instanceKey');

    class User extends Model {
      @ModelValidator
      static [staticKey](): void {
        throw new Error('test error');
      }

      @ModelValidator
      [instanceKey](): void {
        throw new Error('test error');
      }
    }

    sequelize.addModels([User]);

    expect(Object.getOwnPropertySymbols(User.options.validate)).to.deep.eq([
      instanceKey,
      staticKey,
    ]);

    const user = User.build();
    await expect(user.validate()).to.be.rejectedWith('test error');
  });
});
