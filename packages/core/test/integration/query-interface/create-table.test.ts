import { expect } from 'chai';
import { DataTypes } from '@sequelize/core';
import { sequelize } from '../support';

const { queryInterface, dialect } = sequelize;
const dialectName = dialect.name;

describe.only('QueryInterface#createTable', () => {
  it('should work with enums (1)', async () => {
    await queryInterface.createTable('SomeTable', {
      someEnum: DataTypes.ENUM('value1', 'value2', 'value3'),
    });

    // !TODO: add tests for other dialects

    const table = await queryInterface.describeTable('SomeTable');
    if (dialectName.includes('postgres')) {
      expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
    }
  });

  it('should work with enums (2)', async () => {
    await queryInterface.createTable('SomeTable', {
      someEnum: {
        type: DataTypes.ENUM(['value1', 'value2', 'value3']),
      },
    });

    const table = await queryInterface.describeTable('SomeTable');
    if (dialectName.includes('postgres')) {
      expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
    }
  });

  it('should work with enums (3)', async () => {
    await queryInterface.createTable('SomeTable', {
      someEnum: {
        type: DataTypes.ENUM(['value1', 'value2', 'value3']),
        field: 'otherName',
      },
    });

    const table = await queryInterface.describeTable('SomeTable');
    if (dialectName.includes('postgres')) {
      expect(table.otherName.special).to.deep.equal(['value1', 'value2', 'value3']);
    }
  });

  if (dialect.supports.schemas) {
    it('should work with enums (4, schemas)', async () => {
      await queryInterface.createSchema('archive');

      await queryInterface.createTable({ tableName: 'SomeTable', schema: 'archive' }, {
        someEnum: {
          type: DataTypes.ENUM(['value1', 'value2', 'value3']),
          field: 'otherName',
        },
      });

      const table = await queryInterface.describeTable({ tableName: 'SomeTable', schema: 'archive' });
      if (dialectName.includes('postgres')) {
        expect(table.otherName.special).to.deep.equal(['value1', 'value2', 'value3']);
      }
    });
  }

  it('should work with enums (5)', async () => {
    await queryInterface.createTable('SomeTable', {
      someEnum: {
        type: DataTypes.ENUM(['COMMENT']),
        comment: 'special enum col',
      },
    });

    const table = await queryInterface.describeTable('SomeTable');
    expect(table.someEnum.comment).to.equal('special enum col');

    if (dialectName.includes('postgres')) {
      expect(table.someEnum.special).to.deep.equal(['COMMENT']);
    }
  });
});
