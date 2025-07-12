import { FindAttributeOptions, Model, ModelStatic, Order, Sequelize, WhereOptions } from '.';

export class QueryBuilder<M extends Model = Model> {
  _attributes: FindAttributeOptions | undefined;
  _where: WhereOptions | undefined;
  _order: Order | undefined;
  _limit: number | undefined;
  _offset: number | undefined;
  _isSelect: boolean;
  _model: M;
  _sequelize: Sequelize;

  constructor(model?: M);
  clone(): QueryBuilder<M>;
  select(): QueryBuilder<M>;
  attributes(attributes: FindAttributeOptions): QueryBuilder<M>;
  where(conditions: WhereOptions): QueryBuilder<M>;
  orderBy(order: Order | undefined): QueryBuilder<M>;
  limit(limit: number): QueryBuilder<M>;
  offset(offset: number): QueryBuilder<M>;
  getQuery(): string;
  execute(): Promise<[unknown[], unknown]>;
  get tableName(): string;
  get model(): ModelStatic<M>;
}

