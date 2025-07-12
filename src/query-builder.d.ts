import { FindAttributeOptions, GroupOption, Model, ModelStatic, Order, Sequelize, WhereOptions } from '.';

export class QueryBuilder<M extends Model = Model> {
  private _attributes: FindAttributeOptions | undefined;
  private _where: WhereOptions | undefined;
  private _group: GroupOption | undefined;
  private _order: Order | undefined;
  private _limit: number | undefined;
  private _offset: number | undefined;
  private _isSelect: boolean;
  private _model: M;
  private _sequelize: Sequelize;

  constructor(model?: M);
  clone(): QueryBuilder<M>;
  select(): QueryBuilder<M>;
  attributes(attributes: FindAttributeOptions): QueryBuilder<M>;
  where(conditions: WhereOptions): QueryBuilder<M>;
  groupBy(group: GroupOption): QueryBuilder<M>;
  orderBy(order: Order | undefined): QueryBuilder<M>;
  limit(limit: number): QueryBuilder<M>;
  offset(offset: number): QueryBuilder<M>;
  getQuery(): string;
  execute(): Promise<[unknown[], unknown]>;
  get tableName(): string;
  get model(): ModelStatic<M>;
}

