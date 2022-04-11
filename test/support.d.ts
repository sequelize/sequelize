import type { Sequelize, Options } from '@sequelize/core';

export const sequelize: Sequelize;
export const getTestDialectTeaser: (name: string) => string;
export const resetSequelizeInstance: () => void;
export const createSequelizeInstance: (options: Options) => Sequelize;
