import type { BindOrReplacements } from '../../sequelize';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
}
