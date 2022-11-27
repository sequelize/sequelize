import type { Sequelize } from 'src/sequelize';
import type { AbstractQueryGenerator } from './query-generator';
import type { QueryInterface } from './query-interface';

class AbstractQueryInterface implements QueryInterface {
  sequelize: Sequelize;
  queryGenerator: AbstractQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: AbstractQueryGenerator) {
    this.sequelize = sequelize;
    this.queryGenerator = queryGenerator;
  }

  /*
    * Phase 1
    * The first step would be to write _experimental_selectQuery , or at least the basics of it
    * (very simple stuff like select from where). No join, no group by, no order by (because the
    * current implementation has issues we should tackle immediately)
    */

}

export default AbstractQueryInterface;
