import { DataTypes } from '@sequelize/core';
import { sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialectName = sequelize.dialect.name;

// TODO: extend suite to cover all data sub-types, like in geometry.test.ts
describe('GEOGRAPHY', () => {
  testDataTypeSql('GEOGRAPHY', DataTypes.GEOGRAPHY, {
    default: new Error(
      `${dialectName} does not support the GEOGRAPHY data type.\nSee https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`,
    ),
    postgres: 'GEOGRAPHY',
  });
});
