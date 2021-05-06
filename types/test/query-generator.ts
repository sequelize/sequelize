import { expectTypeOf } from 'expect-type';
import { fn, literal, col, QueryGenerator } from 'sequelize';

declare let queryGenerator: QueryGenerator;

expectTypeOf(
    queryGenerator.handleSequelizeMethod(fn('FOO_BAR'))
).toMatchTypeOf<string>();
expectTypeOf(
    queryGenerator.handleSequelizeMethod(literal('FOO_BAR'))
).toMatchTypeOf<string>();
expectTypeOf(
    queryGenerator.handleSequelizeMethod(col('foo_bar'))
).toMatchTypeOf<string>();

// @ts-expect-error literal object
queryGenerator.handleSequelizeMethod({ myCol: '<my-val>' })
