import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.js';

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  fromArray(input: string[] | string): string[];
}
