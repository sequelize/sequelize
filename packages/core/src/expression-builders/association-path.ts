import { BaseSqlExpression } from './base-sql-expression.js';

export class AssociationPath extends BaseSqlExpression {
  declare private readonly brand: 'associationPath';

  constructor(
    readonly associationPath: readonly string[],
    readonly attributeName: string,
  ) {
    super();
  }
}
