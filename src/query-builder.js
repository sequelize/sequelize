/* eslint-disable semi */
class QueryBuilder {
  /** @type {import('.').FindAttributeOptions | undefined} */
  _attributes

  /** @type {import('.').WhereOptions | undefined} */
  _where;

  /** @type {import('.').Order | undefined} */
  _order;

  /** @type {number | undefined} */
  _limit;

  /** @type {number | undefined} */
  _offset;

  /** @type {import('./model').Model} */
  _model;
  
  /** @type {import('./sequelize').Sequelize} */
  _sequelize;
  
  /** @type {boolean} */
  _isSelect = false;

  constructor(model) {
    this._model = model;
    this._sequelize = model.sequelize;
  }

  /**
   * Creates a clone of the current query builder instance with all properties copied over
   *
   * @returns {QueryBuilder} A new QueryBuilder instance with the same properties
   */
  clone() {
    const newBuilder = new QueryBuilder(this._model);
    newBuilder._sequelize = this._sequelize;
    newBuilder._isSelect = this._isSelect;
    newBuilder._attributes = this._attributes;
    newBuilder._where = this._where;
    newBuilder._order = this._order;
    newBuilder._limit = this._limit;
    newBuilder._offset = this._offset;

    return newBuilder;
  }

  /**
   * Initialize a SELECT query
   *
   * @returns {QueryBuilder} The query builder instance for chaining
   */
  select() {
    const newBuilder = new QueryBuilder(this._model);
    newBuilder._isSelect = true;

    return newBuilder;
  }

  /**
   * Specify which attributes to select
   *
   * @param {import('.').FindAttributeOptions} attributes - Array of attribute names or attribute options
   * @returns {QueryBuilder} The query builder instance for chaining
   */
  attributes(attributes) {
    const newBuilder = this.clone();
    newBuilder._attributes = attributes;

    return newBuilder;
  }

  /**
   * Add WHERE conditions to the query
   *
   * @param {import('.').WhereOptions} conditions - Where conditions object
   * @returns {QueryBuilder} The query builder instance for chaining
   */
  where(conditions) {
    const newBuilder = this.clone();
    newBuilder._where = conditions;

    return newBuilder;
  }

  orderBy(order) {
    const newBuilder = this.clone();
    newBuilder._order = order;

    return newBuilder;
  }

  /**
   * Set a LIMIT clause on the query
   *
   * @param {number} limit - Maximum number of rows to return
   * @returns {QueryBuilder} The query builder instance for chaining
   */
  limit(limit) {
    const newBuilder = this.clone();
    newBuilder._limit = limit;

    return newBuilder;
  }

  /**
   * Set an OFFSET clause on the query
   *
   * @param {number} offset - Number of rows to skip
   * @returns {QueryBuilder} The query builder instance for chaining
   */
  offset(offset) {
    const newBuilder = this.clone();
    newBuilder._offset = offset;

    return newBuilder;
  }

  /**
   * Generate the SQL query string
   *
   * @returns {string} The SQL query
   */
  getQuery() {
    if (!this._isSelect) {
      throw new Error('Query builder requires select() to be called first');
    }

    const queryGenerator = this._model.queryGenerator;
    const tableName = this._model.tableName;

    // Build the options object that matches Sequelize's FindOptions pattern
    /** @type {import('.').FindOptions} */
    const options = {
      attributes: this._attributes,
      where: this._where,
      order: this._order,
      limit: this._limit,
      offset: this._offset,
      raw: true,
      plain: false,
      model: this._model
    };

    // Generate the SQL using the existing query generator
    const sql = queryGenerator.selectQuery(tableName, options, this._model);

    return sql;
  }

  /**
   * Executes the raw query
   *
   * @returns {Promise<[unknown[], unknown]>} The result of the query
   */
  async execute() {
    const sql = this.getQuery();

    return this._sequelize.query(sql);
  }
}

module.exports = QueryBuilder;