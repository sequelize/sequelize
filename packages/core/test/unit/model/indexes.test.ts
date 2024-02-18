import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('Model indexes', () => {
  if (dialect.supports.dataTypes.JSONB) {
    it('uses a gin index for JSONB attributes by default', () => {
      const Model = sequelize.define('event', {
        eventData: {
          type: DataTypes.JSONB,
          field: 'data',
          index: true,
        },
      });

      expect(Model.getIndexes()).to.deep.eq([
        {
          column: 'eventData',
          fields: ['data'],
          using: 'gin',
          name: 'events_data',
        },
      ]);
    });
  }

  it('should set the unique property when type is unique', () => {
    const Model = sequelize.define(
      'm',
      {},
      {
        indexes: [
          {
            type: 'unique',
            fields: ['firstName'],
          },
          {
            type: 'UNIQUE',
            fields: ['lastName'],
          },
        ],
      },
    );

    expect(Model.getIndexes()).to.deep.eq([
      {
        fields: ['firstName'],
        unique: true,
        name: 'ms_first_name_unique',
      },
      {
        fields: ['lastName'],
        unique: true,
        name: 'ms_last_name_unique',
      },
    ]);
  });

  // Model.getIndexes() is the only source of truth for indexes
  it('does not copy model-level indexes to individual attributes', () => {
    const User = sequelize.define(
      'User',
      {
        username: DataTypes.STRING,
      },
      {
        indexes: [
          {
            unique: true,
            fields: ['username'],
          },
        ],
      },
    );

    // @ts-expect-error -- "unique" gets removed from built attributes
    expect(User.getAttributes().username.unique).to.be.undefined;
  });

  it('supports declaring an index on an attribute', () => {
    const User = sequelize.define('User', {
      name: {
        type: DataTypes.STRING,
        index: true,
      },
    });

    expect(User.getIndexes()).to.deep.eq([
      {
        column: 'name',
        fields: ['name'],
        name: 'users_name',
      },
    ]);
  });

  it('merges indexes with the same name', () => {
    const User = sequelize.define(
      'User',
      {
        firstName: {
          type: DataTypes.STRING,
          index: 'name',
        },
        middleName: {
          type: DataTypes.STRING,
          index: {
            name: 'name',
          },
        },
        lastName: {
          type: DataTypes.STRING,
          index: 'name',
        },
      },
      {
        indexes: [
          {
            name: 'name',
            fields: ['nickname'],
          },
        ],
      },
    );

    expect(User.getIndexes()).to.deep.eq([
      {
        fields: ['nickname', 'firstName', 'middleName', 'lastName'],
        name: 'name',
      },
    ]);
  });

  it('throws if two indexes with the same name use incompatible options', () => {
    expect(() => {
      sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          index: {
            name: 'name',
            unique: true,
          },
        },
        lastName: {
          type: DataTypes.STRING,
          index: {
            name: 'name',
            unique: false,
          },
        },
      });
    }).to.throw(
      'Index "name" has conflicting options: "unique" was defined with different values true and false.',
    );
  });

  it('supports using index & unique at the same time', () => {
    const User = sequelize.define('User', {
      firstName: {
        type: DataTypes.STRING,
        unique: true,
        index: true,
      },
    });

    expect(User.getIndexes()).to.deep.eq([
      {
        fields: ['firstName'],
        column: 'firstName',
        unique: true,
        name: 'users_first_name_unique',
      },
      {
        fields: ['firstName'],
        column: 'firstName',
        name: 'users_first_name',
      },
    ]);
  });

  it('supports configuring the index attribute options', () => {
    const User = sequelize.define('User', {
      firstName: {
        type: DataTypes.STRING,
        columnName: 'first_name',
        index: {
          name: 'first_last_name',
          unique: true,
          attribute: {
            collate: 'en_US',
            operator: 'text_pattern_ops',
            order: 'DESC',
          },
        },
      },
      lastName: {
        type: DataTypes.STRING,
        columnName: 'last_name',
        index: {
          name: 'first_last_name',
          unique: true,
        },
      },
    });

    expect(User.getIndexes()).to.deep.eq([
      {
        fields: [
          {
            name: 'first_name',
            collate: 'en_US',
            operator: 'text_pattern_ops',
            order: 'DESC',
          },
          'last_name',
        ],
        unique: true,
        name: 'first_last_name',
      },
    ]);
  });
});
