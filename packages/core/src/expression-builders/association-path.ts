import { BaseSqlExpression } from './base-sql-expression.js';

export class AssociationPath extends BaseSqlExpression {
  private declare readonly brand: 'associationPath';

  constructor(
    readonly associationPath: readonly string[],
    readonly attributeName: string,
  ) {
    super();
  }
}
