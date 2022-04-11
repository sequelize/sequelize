import type { Sequelize } from '@sequelize/core';

declare namespace Chai {
  interface Assertion {
    deepEqual(expected: any): Assertion;
  }
}

export const sequelize: Sequelize;
export const getTestDialectTeaser: (name: string) => string;
