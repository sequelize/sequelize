import type { Nullish } from '@sequelize/utils';

export type SQLFragment = string | Nullish | SQLFragment[];
export type TruthySQLFragment = string | SQLFragment[];
