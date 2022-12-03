import { expect } from 'chai';
import type { InferAttributes } from '@sequelize/core';
import { Model, DataTypes } from '@sequelize/core';
import { Table, Attribute, Unique, AutoIncrement, PrimaryKey, NotNull, AllowNull, Comment, Default, ColumnName } from '@sequelize/core/decorators-legacy';
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

  it('rejects conflicting validates', () => {
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

  it('merges "unique"', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute({
        type: DataTypes.STRING,
        unique: true,
      })
      @Attribute({
        unique: 'firstName-lastName',
      })
      @Unique(['firstName-country'])
      declare firstName: string;

      @Attribute({
        type: DataTypes.STRING,
        unique: 'firstName-lastName',
      })
      declare lastName: string;

      @Attribute(DataTypes.STRING)
      @Unique('firstName-country')
      declare country: string;
    }

    sequelize.addModels([User]);

    expect(User.getIndexes()).to.deep.equal([
      {
        fields: ['firstName', 'country'],
        msg: null,
        column: 'country',
        customIndex: true,
        unique: true,
        name: 'firstName-country',
      },
      {
        fields: ['firstName', 'lastName'],
        msg: null,
        column: 'lastName',
        customIndex: true,
        unique: true,
        name: 'firstName-lastName',
      },
      {
        fields: ['firstName'],
        msg: null,
        column: 'firstName',
        customIndex: true,
        unique: true,
        name: 'users_first_name_unique',
      },
    ]);
  });
});

describe('@AllowNull', () => {
  it('sets allowNull to true', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @AllowNull
      declare name: string;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().name.allowNull).to.equal(true);
  });

  it('accepts a boolean', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @AllowNull(false)
      declare name: string;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().name.allowNull).to.equal(false);
  });
});

describe('@NotNull', () => {
  it('sets allowNull to false', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @NotNull
      declare name: string;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().name.allowNull).to.equal(false);
  });

  it('accepts a boolean', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @NotNull(false)
      declare name: string;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().name.allowNull).to.equal(true);
  });
});

describe('@AutoIncrement', () => {
  it('sets autoIncrement to true', () => {
    @Table({ noPrimaryKey: true })
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.INTEGER)
      @AutoIncrement
      declare int: number;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().int.autoIncrement).to.equal(true);
  });
});

describe('@PrimaryKey', () => {
  it('sets primaryKey to true', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.INTEGER)
      @PrimaryKey
      declare int: number;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().int.primaryKey).to.equal(true);
  });
});

describe('@Comment', () => {
  it('sets comment', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.INTEGER)
      @Comment('This is a comment')
      declare int: number;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().int.comment).to.equal('This is a comment');
  });

  it('requires a parameter', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        // @ts-expect-error -- testing that this rejects
        @Comment()
        declare int: number;
      }

      return User;
    }).to.throw();
  });

  it('requires being called', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        // @ts-expect-error -- testing that this throws
        @Comment
        declare int: number;
      }

      return User;
    }).to.throw();
  });
});

describe('@Default', () => {
  it('sets defaultValue', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.INTEGER)
      @Default(1)
      declare int: number;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().int.defaultValue).to.equal(1);
  });

  it('requires a parameter', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        // @ts-expect-error -- testing that this throws
        @Default()
        declare int: number;
      }

      return User;
    }).to.throw();
  });

  it('requires being called', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        // @ts-expect-error -- testing that this throws
        @Default
        declare int: number;
      }

      return User;
    }).to.throw();
  });
});

describe('@ColumnName', () => {
  it('sets to which column the attribute maps', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.INTEGER)
      @ColumnName('userId')
      declare int: number;
    }

    sequelize.addModels([User]);

    expect(User.getAttributes().int.field).to.equal('userId');
  });

  it('requires a parameter', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        // @ts-expect-error -- testing that this throws
        @ColumnName()
        declare int: number;
      }

      return User;
    }).to.throw();
  });

  it('requires being called', () => {
    expect(() => {
      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        // @ts-expect-error -- testing that this throws
        @ColumnName
        declare int: number;
      }

      return User;
    }).to.throw();
  });
});
