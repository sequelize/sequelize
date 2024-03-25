import type { Falsy } from '@sequelize/utils';

export type SQLFragment = string | Falsy | SQLFragment[];
export type TruthySQLFragment = string | SQLFragment[];
