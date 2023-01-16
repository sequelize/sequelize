import type { BindOrReplacements } from '@sequelize/core/src/sequelize';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
}
