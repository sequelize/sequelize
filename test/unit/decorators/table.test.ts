import { expect } from 'chai';
import { Model } from '@sequelize/core';
import { Table } from '@sequelize/core/decorators-legacy';
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

    expect(() => Test.init({}, { sequelize })).to.throw(/pass your model to the Sequelize constructor/);
  });

  it('supports specifying options', () => {
    @Table({ tableName: 'custom_users' })
    class User extends Model {}

    sequelize.addModels([User]);

    expect(User.tableName).to.equal('custom_users');
  });

  // different decorators can modify the model's options
  it('can be used multiple times', () => {
    @Table({ tableName: 'custom_users' })
    @Table({ timestamps: false })
    @Table({ tableName: 'custom_users' }) // same value: ignored
    class User extends Model {}

    sequelize.addModels([User]);

    expect(User.tableName).to.equal('custom_users');
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
      indexes: [{
        fields: ['id'],
        unique: true,
      }],
    })
    @Table({
      indexes: [{
        fields: ['createdAt'],
      }],
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
});
