import assert from 'node:assert';
import type { DataTypeClassOrInstance } from '@sequelize/core';
import { createTester, expectsql, sequelize } from '../../support';

export const testDataTypeSql = createTester((it, description: string, dataType: DataTypeClassOrInstance, expectation) => {
  it(description, () => {
    let result: Error | string;

    try {
      result = typeof dataType === 'string' ? dataType : sequelize.normalizeDataType(dataType).toSql({ dialect: sequelize.dialect });
    } catch (error) {
      assert(error instanceof Error);
      result = error;
    }

    return expectsql(result, expectation);
  });
});
