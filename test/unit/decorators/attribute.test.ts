import type { InferAttributes } from '@sequelize/core';
import { Model, DataTypes } from '@sequelize/core';
import { Attribute } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe(`@Attribute legacy decorator`, () => {
  it('does not init the model itself', () => {
    class Test extends Model {
      @Attribute(DataTypes.BIGINT)
      declare id: bigint;
    }

    expect(() => new Test()).to.throw(/has not been initialized/);
  });

  it('prevents using Model.init', () => {
    class Test extends Model {
      @Attribute(DataTypes.BIGINT)
      declare id: bigint;
    }

    expect(() => Test.init({}, { sequelize })).to.throw(/pass your model to the Sequelize constructor/);
  });

  it('registers an attribute when sequelize.addModels is called', () => {
    class BigIntModel extends Model<InferAttributes<BigIntModel>> {
      @Attribute({ type: DataTypes.BIGINT, primaryKey: true })
      declare id: bigint;

      @Attribute(DataTypes.STRING)
      declare name: string;
    }

    sequelize.addModels([BigIntModel]);

    expect(BigIntModel.getAttributes()).to.have.keys(['id', 'createdAt', 'updatedAt', 'name']);
    expect(BigIntModel.getAttributes().id.type).to.be.instanceof(DataTypes.BIGINT);
    expect(BigIntModel.getAttributes().id.primaryKey).to.eq(true);
    expect(BigIntModel.getAttributes().name.type).to.be.instanceof(DataTypes.STRING);
  });

  it('works on getters', () => {
    class User extends Model {
      @Attribute(DataTypes.STRING)
      get name(): string {
        return `My name is ${this.getDataValue('name')}`;
      }

      set name(value: string) {
        this.setDataValue('name', value);
      }
    }

    sequelize.addModels([User]);

    const user = new User({});
    user.name = 'Peter';

    expect(user.name).to.equal('My name is Peter');
    expect(user.getDataValue('name')).to.equal('Peter');
  });

  it('works on setters', () => {
    class User extends Model {
      get name(): string {
        return `My name is ${this.getDataValue('name')}`;
      }

      @Attribute(DataTypes.STRING)
      set name(value: string) {
        this.setDataValue('name', value);
      }
    }

    sequelize.addModels([User]);

    const user = new User({});
    user.name = 'Peter';

    expect(user.name).to.equal('My name is Peter');
    expect(user.getDataValue('name')).to.equal('Peter');
  });

  // different decorators can modify the model's options
  it('can be used multiple times', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute({ type: DataTypes.STRING, primaryKey: true })
      @Attribute({ type: DataTypes.STRING, autoIncrement: true })
      @Attribute(DataTypes.STRING)
      declare pk: string;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().pk.primaryKey).to.equal(true);
    expect(User.getAttributes().pk.autoIncrement).to.equal(true);
  });

  it('throws if used multiple times with incompatible options', () => {
    expect(() => {
      class User extends Model {
        @Attribute({ type: DataTypes.STRING, primaryKey: true })
        @Attribute({ type: DataTypes.STRING, primaryKey: false })
        declare pk: string;
      }

      return User;
    }).to.throw();
  });

  it('merges validate', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute({
        type: DataTypes.STRING,
        validate: {
          not: 'abc',
        },
      })
      @Attribute({
        type: DataTypes.STRING,
        validate: {
          is: 'abc',
        },
      })
      declare pk: string;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().pk.validate).to.deep.equal({ not: 'abc', is: 'abc' });
  });

  it('rejects conflicting getterMethods', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute({
          type: DataTypes.STRING,
          validate: {
            not: 'abc',
          },
        })
        @Attribute({
          type: DataTypes.STRING,
          validate: {
            not: 'def',
          },
        })
        declare pk: string;
      }

      return User;
    }).to.throw();
  });
});
