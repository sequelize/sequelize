import { AbstractQueryGenerator } from '@sequelize/core';
import {DuckDbQueryGeneratorInternal} from "./query-generator.internal";
import {DuckDbDialect} from "./dialect";

export class DuckDbQueryGeneratorTypeScript extends AbstractQueryGenerator {
  readonly #internals: DuckDbQueryGeneratorInternal;

  constructor(
    dialect: DuckDbDialect,
    internals: DuckDbQueryGeneratorInternal = new DuckDbQueryGeneratorInternal(dialect),
  ) {
    super(dialect, internals);

    this.#internals = internals;
  }

  versionQuery(): string {
    return 'SELECT library_version as version from pragma_version()';
  }
}
