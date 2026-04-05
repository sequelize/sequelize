import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

export class AssociationPath extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'associationPath';

  constructor(
    readonly associationPath: readonly string[],
    readonly attributeName: string,
  ) {
    super();
  }
}
