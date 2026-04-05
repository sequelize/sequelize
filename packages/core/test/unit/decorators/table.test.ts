import { Model, sql } from '@sequelize/core';
import { Table } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import omit from 'lodash/omit';
import { sequelize } from '../../support';

describe(`@Table legacy decorator`, () => {
  it('does not init the model itself', () => {
    @Table
    class Test extends Model {}

    expect(() => Test.build()).to.throw(/has not been initialized/);
  });

  it('prevents using Model.init', () => {
    @Table
    class Test extends Model {
      declare id: bigint;
    }

    expect(() => Test.init({}, { sequelize })).to.throw(
      /pass your model to the Sequelize constructor/,
    );
  });

  it('supports specifying options', () => {
    @Table({ tableName: 'custom_users' })
    class User extends Model {}

    sequelize.addModels([User]);

    expect(User.table.tableName).to.equal('custom_users');
  });

  // different decorators can modify the model's options
  it('can be used multiple times', () => {
    @Table({ tableName: 'custom_users' })
    @Table({ timestamps: false })
    @Table({ tableName: 'custom_users' }) // same value: ignored
    class User extends Model {}

    sequelize.addModels([User]);

    expect(User.table.tableName).to.equal('custom_users');
    expect(User.options.timestamps).to.equal(false);
  });

  it('throws if used multiple times with incompatible options', () => {
    expect(() => {
      @Table({ tableName: 'custom_users' })
      @Table({ tableName: 'custom_use' })
      class User extends Model {}

      return User;
    }).to.throw();
  });

  it('merges indexes', () => {
    @Table({
      indexes: [
        {
          fields: ['id'],
          unique: true,
        },
      ],
    })
    @Table({
      indexes: [
        {
          fields: ['createdAt'],
        },
      ],
    })
    class User extends Model {}

    sequelize.addModels([User]);

    expect(User.getIndexes()).to.deep.equal([
      {
        column: 'createdAt',
        fields: ['createdAt'],
        name: 'users_created_at',
      },
      {
        column: 'id',
        fields: ['id'],
        unique: true,
        name: 'users_id_unique',
      },
    ]);
  });

  it('does not crash when inheriting options', () => {
    @Table.Abstract({})
    class ParentModel extends Model {}

    @Table({
      indexes: [
        {
          fields: ['id'],
          unique: true,
        },
      ],
    })
    class User extends ParentModel {}

    sequelize.addModels([User]);
  });

  it('merges scopes', () => {
    @Table({
      scopes: {
        scope1: {},
      },
    })
    @Table({
      scopes: {
        scope2: {},
      },
    })
    class User extends Model {}

    sequelize.addModels([User]);

    expect(User.options.scopes).to.deep.equal({
      scope1: {},
      scope2: {},
    });
  });

  it('rejects conflicting scopes', () => {
    expect(() => {
      @Table({
        scopes: {
          scope1: {},
        },
      })
      @Table({
        scopes: {
          scope1: {},
        },
      })
      class User extends Model {}

      return User;
    }).to.throw();
  });

  it('is inheritable', () => {
    function beforeUpdate() {}

    function validate() {
      return true;
    }

    const literal = sql`1 = 1`;

    @Table({
      // will not be inherited
      tableName: 'users',
      name: {
        plural: 'Users',
        singular: 'User',
      },
      modelName: 'User',

      // will be inherited (overwritten)
      schema: 'custom_schema',
      timestamps: false,
      paranoid: true,
      comment: 'This is a table',
      noPrimaryKey: true,
      engine: 'InnoDB',
      charset: 'utf8',
      collate: 'utf8_general_ci',
      freezeTableName: true,
      deletedAt: 'deleteDate',
      createdAt: 'createDate',
      updatedAt: 'updateDate',
      version: true,
      omitNull: true,
      underscored: true,
      hasTrigger: true,
      schemaDelimiter: '_',
      initialAutoIncrement: '1000',
      // must be cloned
      defaultScope: {
        // testing that this is cloned correctly
        where: literal,
      },

      // will be inherited (merged, see subsequent tests)
      validate: {
        validate,
      },
      scopes: {
        scope1: {
          // testing that this is cloned correctly
          where: literal,
        },
      },
      indexes: [
        {
          name: 'index1',
          fields: [
            // testing that this is cloned correctly
            literal,
          ],
        },
      ],
      hooks: {
        beforeUpdate,
      },
    })
    class BaseUser extends Model {}

    class InheritedUser extends BaseUser {}

    // can be registered even if the base class is not
    sequelize.addModels([InheritedUser]);

    // registration order does not matter
    sequelize.addModels([BaseUser]);

    const baseOptions = omit(BaseUser.modelDefinition.options, ['sequelize']);
    const inheritedOptions = omit(InheritedUser.modelDefinition.options, ['sequelize']);

    // make sure parent options were not modified
    expect(baseOptions).to.deep.equal({
      tableName: 'users',
      name: {
        plural: 'Users',
        singular: 'User',
      },
      modelName: 'User',
      schema: 'custom_schema',
      timestamps: false,
      paranoid: true,
      comment: 'This is a table',
      noPrimaryKey: true,
      engine: 'InnoDB',
      charset: 'utf8',
      collate: 'utf8_general_ci',
      freezeTableName: true,
      deletedAt: 'deleteDate',
      createdAt: 'createDate',
      updatedAt: 'updateDate',
      version: true,
      omitNull: true,
      underscored: true,
      hasTrigger: true,
      schemaDelimiter: '_',
      initialAutoIncrement: '1000',
      defaultScope: {
        where: literal,
      },

      validate: {
        validate,
      },
      scopes: {
        scope1: {
          where: literal,
        },
      },
      indexes: [
        {
          name: 'index1',
          fields: [literal],
        },
      ],
      hooks: {
        beforeUpdate,
      },
    });

    // make sure options are inherited
    expect(inheritedOptions).to.deep.equal({
      // not inherited
      tableName: 'InheritedUser',
      name: {
        plural: 'InheritedUsers',
        singular: 'InheritedUser',
      },
      modelName: 'InheritedUser',

      // inherited
      schema: 'custom_schema',
      timestamps: false,
      paranoid: true,
      comment: 'This is a table',
      noPrimaryKey: true,
      engine: 'InnoDB',
      charset: 'utf8',
      collate: 'utf8_general_ci',
      freezeTableName: true,
      deletedAt: 'deleteDate',
      createdAt: 'createDate',
      updatedAt: 'updateDate',
      version: true,
      omitNull: true,
      underscored: true,
      hasTrigger: true,
      schemaDelimiter: '_',
      initialAutoIncrement: '1000',
      defaultScope: {
        where: literal,
      },
      validate: {
        validate,
      },
      scopes: {
        scope1: {
          where: literal,
        },
      },
      indexes: [
        {
          name: 'index1',
          fields: [literal],
        },
      ],
      hooks: {
        beforeUpdate,
      },
    });

    // must be the same value but a different instance (cloned)
    expect(baseOptions.scopes).not.to.equal(
      inheritedOptions.scopes,
      'scopes option must be a different instance',
    );
    expect(baseOptions.defaultScope).not.to.equal(
      inheritedOptions.defaultScope,
      'defaultScope option must be a different instance',
    );
    expect(baseOptions.indexes).not.to.equal(
      inheritedOptions.indexes,
      'indexes option must be a different instance',
    );
    expect(baseOptions.hooks).not.to.equal(
      inheritedOptions.hooks,
      'indexes option must be a different instance',
    );
    expect(baseOptions.validate).not.to.equal(
      inheritedOptions.validate,
      'validate option must be a different instance',
    );
  });

  it('overwrites defaultScope', () => {
    const literal = sql`1 = 1`;

    @Table({
      defaultScope: {
        where: literal,
      },
    })
    class BaseUser extends Model {}

    @Table({
      defaultScope: {
        order: ['id'],
      },
    })
    class InheritedUser extends BaseUser {}

    sequelize.addModels([BaseUser, InheritedUser]);

    expect(BaseUser.modelDefinition.options.defaultScope).to.deep.equal({
      where: literal,
    });

    expect(InheritedUser.modelDefinition.options.defaultScope).to.deep.equal({
      order: ['id'],
    });
  });

  // the rules for merging are the same as when using the decorator multiple times on the same model
  // the details of which are tested in other tests
  it('merges validate, scopes, indexes & hooks', () => {
    function validate1() {
      return true;
    }

    function beforeUpdate1() {}

    @Table({
      validate: {
        validate1,
      },
      scopes: {
        scope1: { where: { id: 1 } },
      },
      indexes: [
        {
          name: 'index1',
          fields: [],
        },
      ],
      hooks: {
        beforeUpdate: beforeUpdate1,
      },
    })
    class BaseUser extends Model {}

    function validate2() {
      return true;
    }

    function beforeUpdate2() {}

    @Table({
      validate: {
        validate2,
      },
      scopes: {
        scope2: { where: { id: 1 } },
      },
      indexes: [
        {
          name: 'index2',
          fields: [],
        },
      ],
      hooks: {
        beforeUpdate: beforeUpdate2,
      },
    })
    class InheritedUser extends BaseUser {}

    sequelize.addModels([InheritedUser]);

    const inheritedOptions = omit(InheritedUser.modelDefinition.options, ['sequelize']);

    expect(inheritedOptions).to.deep.equal({
      // defaults
      defaultScope: {},
      freezeTableName: false,
      modelName: 'InheritedUser',
      name: {
        plural: 'InheritedUsers',
        singular: 'InheritedUser',
      },
      noPrimaryKey: false,
      paranoid: false,
      schema: '',
      schemaDelimiter: '',
      tableName: 'InheritedUsers',
      timestamps: true,
      underscored: false,

      // inherited
      hooks: {
        beforeUpdate: [beforeUpdate1, beforeUpdate2],
      },
      indexes: [
        {
          name: 'index1',
          fields: [],
        },
        {
          name: 'index2',
          fields: [],
        },
      ],
      scopes: {
        scope1: { where: { id: 1 } },
        scope2: { where: { id: 1 } },
      },
      validate: {
        validate1,
        validate2,
      },
    });
  });
});

describe('@Table.Abstract decorator', () => {
  it('registers options but does not cause allow the model to be registered', () => {
    @Table.Abstract
    class AbstractUser extends Model {}

    sequelize.addModels([AbstractUser]);

    expect(() => AbstractUser.modelDefinition).to.throw(/has not been initialized/);
  });

  it('rejects the tableName & name options', () => {
    expect(() => {
      // @ts-expect-error -- testing that the options are rejected
      @Table.Abstract({
        tableName: 'abc',
        name: {},
      })
      class AbstractUser extends Model {}

      return AbstractUser;
    }).to.throw('Options "tableName" and "name" cannot be set on abstract models.');
  });
});
