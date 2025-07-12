import { FindAttributeOptions, Model, ModelStatic, Sequelize, WhereOptions } from ".";

export class QueryBuilder<M extends Model = Model> {
  _attributes: string[];
  _where: Record<string, any>;
  _limit: number | null;
  _offset: number | null;
  _isSelect: boolean;
  _model: M;
  _sequelize: Sequelize;

  constructor(model?: M);
  clone(): QueryBuilder<M>;
  select(): QueryBuilder<M>;
  attributes(attributes: FindAttributeOptions): QueryBuilder<M>;
  where(conditions: WhereOptions): QueryBuilder<M>;
  limit(limit: number): QueryBuilder<M>;
  offset(offset: number): QueryBuilder<M>;
  getQuery(): string;
  execute(): Promise<[unknown[], unknown]>;
  get tableName(): string;
  get model(): ModelStatic<M>;
}

