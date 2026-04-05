import type { InferAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import {
  AllowNull,
  Attribute,
  AutoIncrement,
  ColumnName,
  Comment,
  Default,
  Index,
  NotNull,
  PrimaryKey,
  Table,
  Unique,
  createIndexDecorator,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import omit from 'lodash/omit';
import { sequelize } from '../../support';

describe(`@Attribute legacy decorator`, () => {
  it('does not init the model itself', () => {
    class Test extends Model {
      @Attribute(DataTypes.BIGINT)
      declare id: bigint;
    }

    expect(() => Test.build()).to.throw(/has not been initialized/);
  });

  it('prevents using Model.init', () => {
    class Test extends Model {
      @Attribute(DataTypes.BIGINT)
      declare id: bigint;
    }

    expect(() => Test.init({}, { sequelize })).to.throw(
      /pass your model to the Sequelize constructor/,
    );
  });

  if (sequelize.dialect.supports.dataTypes.BIGINT) {
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
  } else {
    it('registers an attribute when sequelize.addModels is called', () => {
      class IntModel extends Model<InferAttributes<IntModel>> {
        @Attribute({ type: DataTypes.INTEGER, primaryKey: true })
        declare id: number;

        @Attribute(DataTypes.STRING)
        declare name: string;
      }

      sequelize.addModels([IntModel]);

      expect(IntModel.getAttributes()).to.have.keys(['id', 'createdAt', 'updatedAt', 'name']);
      expect(IntModel.getAttributes().id.type).to.be.instanceof(DataTypes.INTEGER);
      expect(IntModel.getAttributes().id.primaryKey).to.eq(true);
      expect(IntModel.getAttributes().name.type).to.be.instanceof(DataTypes.STRING);
    });
  }

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

    const user = User.build({});
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

    const user = User.build({});
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
        column: 'firstName',
        unique: true,
        name: 'firstName-country',
      },
      {
        fields: ['firstName', 'lastName'],
        column: 'firstName',
        unique: true,
        name: 'firstName-lastName',
      },
      {
        fields: ['firstName'],
        column: 'firstName',
        unique: true,
        name: 'users_first_name_unique',
      },
    ]);
  });

  it('merges "index"', () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @Attribute({
        index: 'firstName-lastName',
      })
      @Index({
        name: 'firstName-country',
      })
      @Index
      @ColumnName('first_name')
      declare firstName: string;

      @Attribute(DataTypes.STRING)
      @Index({
        name: 'firstName-lastName',
        attribute: {
          collate: 'en_US',
        },
      })
      declare lastName: string;

      @Attribute(DataTypes.STRING)
      @Index('firstName-country')
      declare country: string;
    }

    sequelize.addModels([User]);

    expect(User.getIndexes()).to.deep.equal([
      {
        fields: ['first_name'],
        column: 'firstName',
        name: 'users_first_name',
      },
      {
        fields: ['first_name', 'country'],
        column: 'firstName',
        name: 'firstName-country',
      },
      {
        fields: [
          'first_name',
          {
            collate: 'en_US',
            name: 'lastName',
          },
        ],
        column: 'firstName',
        name: 'firstName-lastName',
      },
    ]);
  });

  it('is inherited', () => {
    class DummyModel extends Model {}

    function validate() {
      return true;
    }

    class BaseUser extends Model<InferAttributes<BaseUser>> {
      @Attribute({
        type: DataTypes.INTEGER,
        allowNull: false,
        columnName: 'id',
        defaultValue: 42,
        unique: { name: 'primaryKeyUnique' },
        index: { name: 'primaryKeyIndex' },
        primaryKey: true,
        autoIncrement: true,
        autoIncrementIdentity: true,
        comment: 'This is a comment',
        references: {
          model: DummyModel,
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        validate: {
          validate,
        },
        get() {
          return 42;
        },
        set() {},
      })
      declare primaryKey: number;
    }

    class User extends BaseUser {}

    sequelize.addModels([DummyModel, User]);
    // register in two steps to make sure you can register a model without registering its parent (when the parent is abstract)
    sequelize.addModels([BaseUser]);

    const descendantPrimaryKey = User.modelDefinition.rawAttributes.primaryKey;
    const parentPrimaryKey = BaseUser.modelDefinition.rawAttributes.primaryKey;

    expect(omit(descendantPrimaryKey, ['type'])).to.deep.equal(omit(parentPrimaryKey, ['type']));

    expect(descendantPrimaryKey.type).to.be.instanceOf(DataTypes.INTEGER);

    // must be different instances:
    expect(descendantPrimaryKey.type).to.not.equal(parentPrimaryKey.type);
    expect(descendantPrimaryKey.unique).to.not.equal(parentPrimaryKey.unique);
    expect(descendantPrimaryKey.index).to.not.equal(parentPrimaryKey.index);
    expect(descendantPrimaryKey.references).to.not.equal(parentPrimaryKey.references);
    // model should not be cloned
    // @ts-expect-error -- typing is broad, not worth checking
    expect(descendantPrimaryKey.references.model).to.equal(parentPrimaryKey.references.model);
    expect(descendantPrimaryKey.validate).to.not.equal(parentPrimaryKey.validate);
  });

  it('inherits attributes from multiple levels', () => {
    abstract class RootUser extends Model<InferAttributes<RootUser>> {
      @Attribute(DataTypes.STRING)
      declare name: string;

      @Attribute(DataTypes.STRING)
      declare age: number;
    }

    abstract class BaseUser extends RootUser {
      @Attribute(DataTypes.STRING)
      declare username: string;

      @Attribute(DataTypes.STRING)
      declare password: string;
    }

    class User extends BaseUser {
      @Attribute(DataTypes.STRING)
      declare email: string;
    }

    sequelize.addModels([User]);

    expect([...User.modelDefinition.attributes.keys()]).to.deep.equal([
      'id',
      'email',
      'username',
      'password',
      'name',
      'age',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('respects position of inherited attributes', () => {
    abstract class RootUser extends Model<InferAttributes<RootUser>> {
      @Attribute(DataTypes.STRING)
      @Attribute({ insertBefore: true })
      declare name: string;

      @Attribute(DataTypes.STRING)
      @Attribute({ insertAfter: true })
      declare age: number;
    }

    abstract class BaseUser extends RootUser {
      @Attribute(DataTypes.STRING)
      @Attribute({ insertBefore: true })
      declare username: string;

      @Attribute(DataTypes.STRING)
      @Attribute({ insertAfter: true })
      declare password: string;
    }

    class User extends BaseUser {
      @Attribute(DataTypes.STRING)
      declare email: string;
    }

    sequelize.addModels([User]);

    expect([...User.modelDefinition.attributes.keys()]).to.deep.equal([
      'id',
      'name',
      'username',
      'email',
      'password',
      'age',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('throws if an attribute is set to be inserted before and after', () => {
    expect(() => {
      class User extends Model {
        @Attribute(DataTypes.STRING)
        @Attribute({ insertBefore: true, insertAfter: true })
        declare name: string;
      }

      return User;
    }).to.throw(`Cannot set both 'insertBefore' and 'insertAfter' to true on the same attribute`);
  });
});

describe('createIndexDecorator', () => {
  it('makes it possible to create a composite index with options', () => {
    const MyIndex = createIndexDecorator('MyIndex', {
      name: 'my_custom_index',
      type: 'fulltext',
      where: { name: null },
    });

    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @MyIndex
      @ColumnName('first_name')
      declare firstName: string;

      @Attribute(DataTypes.STRING)
      @MyIndex({
        order: 'DESC',
      })
      declare lastName: string;
    }

    sequelize.addModels([User]);

    expect(User.getIndexes()).to.deep.equal([
      {
        fields: [
          {
            name: 'first_name',
          },
          {
            name: 'lastName',
            order: 'DESC',
          },
        ],
        name: 'my_custom_index',
        type: 'fulltext',
        where: { name: null },
      },
    ]);
  });

  it('uses a snake-case version of the decorator name as the default index name', () => {
    const MyIndex = createIndexDecorator('MyIndex');

    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.STRING)
      @MyIndex
      declare firstName: string;
    }

    sequelize.addModels([User]);

    expect(User.getIndexes()).to.deep.equal([
      {
        fields: [
          {
            name: 'firstName',
          },
        ],
        name: 'my_index',
      },
    ]);
  });
});

describe('@AllowNull legacy decorator', () => {
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

describe('@NotNull legacy decorator', () => {
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

describe('@AutoIncrement legacy decorator', () => {
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

describe('@PrimaryKey legacy decorator', () => {
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

describe('@Comment legacy decorator', () => {
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

describe('@Default legacy decorator', () => {
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

describe('@ColumnName legacy decorator', () => {
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
