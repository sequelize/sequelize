import { Falsy } from './falsy';

export type SQLFragment = string | Falsy | SQLFragment[];
export type TruthySQLFragment = string | SQLFragment[];
