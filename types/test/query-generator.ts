import { expectTypeOf } from 'expect-type';
import { fn, literal, col, Op, QueryGenerator, where } from 'sequelize';

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

expectTypeOf(
    queryGenerator.whereItemsQuery({
        abc: 123,
        [Op.and]: [
            literal('CASE WHEN RAND() > 0.5 THEN TRUE ELSE FALSE END'),
            where(col('abc.xyz'), Op.eq, '<id>'),
        ],
        [Op.or]: [
            literal('TRUE'),
            where(fn('FOO'), { [Op.in]: [1, 2] }),
        ],
    })
).toMatchTypeOf<string>();
expectTypeOf(
    queryGenerator.whereItemsQuery(literal('TRUE'))
).toMatchTypeOf<string>();

// @ts-expect-error literal object
queryGenerator.handleSequelizeMethod({ myCol: '<my-val>' })
// @ts-expect-error literal string
queryGenerator.whereItemsQuery('TRUE')
