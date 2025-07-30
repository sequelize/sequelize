import type { SelectOptions } from '../abstract-dialect/query-generator.js';
import type { WhereOptions } from '../abstract-dialect/where-sql-builder-types.js';
import type {
  FindAttributeOptions,
  GroupOption,
  Model,
  ModelStatic,
  Order,
  OrderItem,
} from '../model.d.ts';
import { Op } from '../operators.js';
import type { Sequelize } from '../sequelize.js';
import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';
import type { Col } from './col.js';
import type { Literal } from './literal.js';
import type { Where } from './where.js';

type QueryBuilderIncludeOptions<M extends Model> = {
  model: ModelStatic<M>;
  as?: string;
  on?: Record<keyof M, Col> | Where;
  attributes?: FindAttributeOptions;
  where?: WhereOptions;
  required?: boolean;
  joinType?: 'LEFT' | 'INNER' | 'RIGHT';
};

type QueryBuilderGetQueryOptions = {
  multiline?: boolean;
};

type IncludeOption = {
  model: ModelStatic<any>;
  as: string;
  required: boolean;
  right: boolean;
  on: Record<string, Col> | Where;
  where: WhereOptions;
  attributes: FindAttributeOptions | string[];
  _isCustomJoin: boolean;
};

/**
 * Do not use me directly. Use Model.select() instead.
 */
export class QueryBuilder<M extends Model = Model> extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'queryBuilder';

  private readonly _model: ModelStatic<M>;
  private _attributes?: FindAttributeOptions | undefined;
  private _where?: WhereOptions;
  private _group: GroupOption | undefined;
  private _having: Literal[] | undefined;
  private _order: Order | undefined;
  private _include: IncludeOption[];
  private _limit?: number | undefined;
  private _offset?: number | undefined;
  private readonly _sequelize: Sequelize;
  private _isSelect: boolean = false;

  constructor(model: ModelStatic<M>) {
    super();
    this._model = model;
    this._sequelize = model.sequelize;
    this._include = [];
  }

  /**
   * Creates a clone of the current query builder instance with all properties copied over
   *
   * @returns A new QueryBuilder instance with the same properties
   */
  clone(): QueryBuilder<M> {
    const newBuilder = new QueryBuilder(this._model);
    newBuilder._isSelect = this._isSelect;
    newBuilder._attributes = this._attributes;
    newBuilder._group = this._group;
    newBuilder._having = this._having;
    newBuilder._where = this._where;
    newBuilder._order = this._order;
    newBuilder._limit = this._limit;
    newBuilder._offset = this._offset;
    newBuilder._include = this._include.map(include => ({ ...include }));

    return newBuilder;
  }

  /**
   * Initialize a SELECT query
   *
   * @returns The query builder instance for chaining
   */
  select(): QueryBuilder<M> {
    const newBuilder = new QueryBuilder(this._model);
    newBuilder._isSelect = true;

    return newBuilder;
  }

  /**
   * Specify which attributes to select
   *
   * @param attributes - Array of attribute names or attribute options
   * @returns The query builder instance for chaining
   */
  attributes(attributes: FindAttributeOptions): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._attributes = attributes;

    return newBuilder;
  }

  /**
   * Add WHERE conditions to the query
   *
   * @param conditions - Where conditions object
   * @returns The query builder instance for chaining
   */
  where(conditions: WhereOptions): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._where = conditions;

    return newBuilder;
  }

  /**
   * Sets the GROUP BY clause for the query
   *
   * @param group
   * @returns The query builder instance for chaining
   */
  groupBy(group: GroupOption): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._group = group;

    return newBuilder;
  }

  /**
   * Sets the HAVING clause for the query (supports only Literal condition)
   *
   * @param having
   * @returns The query builder instance for chaining
   */
  having(having: Literal): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._having = [having];

    return newBuilder;
  }

  /**
   * Allows chaining of additional HAVING conditions
   *
   * @param having
   * @returns The query builder instance for chaining
   */
  andHaving(having: Literal): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._having = [...(newBuilder._having || []), having];

    return newBuilder;
  }

  /**
   * Set the ORDER BY clause for the query
   *
   * @param order - The order to apply to the query
   * @returns The query builder instance for chaining
   */
  orderBy(order: OrderItem[]): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._order = order;

    return newBuilder;
  }

  /**
   * Set a LIMIT clause on the query
   *
   * @param limit - Maximum number of rows to return
   * @returns The query builder instance for chaining
   */
  limit(limit: number): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._limit = limit;

    return newBuilder;
  }

  /**
   * Set an OFFSET clause on the query
   *
   * @param offset - Number of rows to skip
   * @returns The query builder instance for chaining
   */
  offset(offset: number): QueryBuilder<M> {
    const newBuilder = this.clone();
    newBuilder._offset = offset;

    return newBuilder;
  }

  /**
   * Add includes (joins) to the query for custom joins with static models
   *
   * @param options - Include options
   * @returns The query builder instance for chaining
   */
  includes(options: QueryBuilderIncludeOptions<M>) {
    if (!options.model) {
      throw new Error('Model is required for includes');
    }

    if (!options.on) {
      throw new Error('Custom joins require an "on" condition to be specified');
    }

    const newBuilder = this.clone();

    const defaultAttributes = [...options.model.modelDefinition.attributes.keys()];
    const includeOptions = {
      model: options.model,
      as: options.as || options.model.name,
      required: options.required || options.joinType === 'INNER' || false,
      right: options.joinType === 'RIGHT' || false,
      on: options.on,
      where: options.where,
      attributes: options.attributes || defaultAttributes,
      _isCustomJoin: true,
    };

    if (!newBuilder._include) {
      newBuilder._include = [];
    }

    newBuilder._include.push(includeOptions);

    return newBuilder;
  }

  /**
   * Generate the SQL query string
   *
   * @param options
   * @param options.multiline send true if you want to break the SQL into multiple lintes
   * @returns The SQL query
   */
  getQuery({ multiline = false }: QueryBuilderGetQueryOptions = {}): string {
    if (!this._isSelect) {
      throw new Error('Query builder requires select() to be called first');
    }

    const queryGenerator = this._model.queryGenerator;
    const tableName = this.tableName;

    // Process custom includes if they exist
    let processedIncludes = this._include;
    if (this._include && this._include.length > 0) {
      processedIncludes = this._include.map(include => {
        if (include._isCustomJoin) {
          // Ensure the include has all required properties for Sequelize's include system
          return {
            ...include,
            duplicating: false,
            association: { source: this._model }, // No association for custom joins
            parent: {
              model: this._model,
              as: this._model.name,
            },
          };
        }

        return include;
      });
    }

    // Build the options object that matches Sequelize's FindOptions pattern
    const options: SelectOptions<any> = {
      attributes: this._attributes!,
      where: this._where,
      include: processedIncludes,
      order: this._order!,
      limit: this._limit,
      offset: this._offset,
      group: this._group!,
      having:
        this._having && this._having.length > 0
          ? {
              [Op.and]: this._having || [],
            }
          : undefined,
      raw: true,
      plain: false,
      model: this._model,
    };

    // Generate the SQL using the existing query generator
    const sql = queryGenerator.selectQuery(tableName, options, this._model);

    if (multiline) {
      return sql.replaceAll(/FROM|LEFT|INNER|RIGHT|WHERE|GROUP|HAVING|ORDER/g, '\n$&');
    }

    return sql;
  }

  /**
   * Executes the raw query
   *
   * @returns The result of the query
   */
  async execute(): Promise<[unknown[], unknown]> {
    const sql = this.getQuery();

    return this._sequelize.queryRaw(sql);
  }

  /**
   * Get the table name for this query
   *
   * @returns The table name
   */
  get tableName(): string {
    return this._model.modelDefinition.table.tableName;
  }

  /**
   * Get the model class
   *
   * @returns The model class
   */
  get model(): ModelStatic<M> {
    return this._model;
  }
}

/**
 * Creates a new QueryBuilder instance for the given model
 *
 * @param model - The model class
 * @returns A new query builder instance
 */
export function createQueryBuilder<M extends Model>(model: ModelStatic<M>): QueryBuilder<M> {
  return new QueryBuilder(model);
}
