import type { BindOrReplacements } from 'src/sequelize';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
}
