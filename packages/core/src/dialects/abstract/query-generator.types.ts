import type { Class } from 'type-fest';
import type { Deferrable } from '../../deferrable';
import type { BindOrReplacements } from '../../sequelize';

export interface QueryWithBindParams {
  query: string;
  bind: BindOrReplacements;
}

export interface DeferConstraintsQueryOptions {
  deferrable: Deferrable | Class<Deferrable>;
}
