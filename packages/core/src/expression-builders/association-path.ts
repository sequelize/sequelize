import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

export class AssociationPath extends BaseSqlExpression {
  static readonly [SQL_IDENTIFIER]: string = 'associationPath';

  constructor(
    readonly associationPath: readonly string[],
    readonly attributeName: string,
  ) {
    super();
  }
}
