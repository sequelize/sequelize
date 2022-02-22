import { expectTypeOf } from 'expect-type';
import {
  AndOperator,
  fn,
  Model,
  Op,
  OrOperator,
  Sequelize,
  WhereOperators,
  WhereOptions,
  literal,
  Transaction,
  and, or,
} from 'sequelize';

// NOTE: most typing tests for WhereOptions are located in test/unit/sql/where.test.ts

class MyModel extends Model {
  declare hi: number;
}

// Optional values
expectTypeOf<{ needed: number; optional?: number }>().toMatchTypeOf<WhereOptions>();

// Operators

// cannot use column references in Op.any
expectTypeOf({ [Op.eq]: { [Op.any]: [Sequelize.col('SOME_COL'), 2, 3], } }).not.toMatchTypeOf<WhereOperators>();
expectTypeOf({ [Op.eq]: { [Op.all]: [Sequelize.col('SOME_COL'), 2, 3], } }).not.toMatchTypeOf<WhereOperators>();

expectTypeOf({ [Op.ne]: { [Op.any]: [Sequelize.col('SOME_COL'), 2, 3], } }).not.toMatchTypeOf<WhereOperators>();
expectTypeOf({ [Op.ne]: { [Op.all]: [Sequelize.col('SOME_COL'), 2, 3], } }).not.toMatchTypeOf<WhereOperators>();

// cannot use literal inside the array of Op.any
expectTypeOf({ [Op.ne]: { [Op.any]: [Sequelize.literal('1'), 2, 3], } }).not.toMatchTypeOf<WhereOperators>();
expectTypeOf({ [Op.ne]: { [Op.all]: [Sequelize.literal('1'), 2, 3], } }).not.toMatchTypeOf<WhereOperators>();

expectTypeOf({
  [Op.startsWith]: 'hat',
  [Op.endsWith]: 'hat',
  [Op.substring]: 'hat',
  [Op.regexp]: '^[h|a|t]', // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
  [Op.notRegexp]: '^[h|a|t]', // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
  [Op.iRegexp]: '^[h|a|t]',  // ~* '^[h|a|t]' (PG only)
  [Op.notIRegexp]: '^[h|a|t]', // !~* '^[h|a|t]' (PG only)
}).toMatchTypeOf<WhereOperators>();

expectTypeOf({
  [Op.and]: { a: 5 }, // AND (a = 5)
}).toMatchTypeOf<AndOperator>();
expectTypeOf({
  [Op.and]: { a: 5 }, // AND (a = 5)
}).toMatchTypeOf<AndOperator<{ a: number }>>();

expectTypeOf({
  [Op.or]: [{ a: 5 }, { a: 6 }], // (a = 5 OR a = 6)
}).toMatchTypeOf<OrOperator>();
expectTypeOf({
  [Op.or]: [{ a: 5 }, { a: 6 }], // (a = 5 OR a = 6)
}).toMatchTypeOf<OrOperator<{ a: number }>>();

// Complex where options via combinations

expectTypeOf([
  { [Op.or]: [{ a: 5 }, { a: 6 }] },
  Sequelize.and(),
  Sequelize.or(),
  { [Op.and]: [] },
  { rank: Sequelize.and({ [Op.lt]: 1000 }, { [Op.eq]: null }) },
  { rank: Sequelize.or({ [Op.lt]: 1000 }, { [Op.eq]: null }) },
  { rank: { [Op.or]: { [Op.lt]: 1000, [Op.eq]: null } } },
  {
    createdAt: {
      [Op.lt]: new Date(),
      [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  },
  {
    [Op.or]: [
      { title: { [Op.like]: 'Boat%' } },
      { description: { [Op.like]: '%boat%' } },
    ],
  },
  {
    meta: {
      [Op.contains]: {
        site: {
          url: 'https://sequelize.org/',
        },
      },
    },
    meta2: {
      [Op.contains]: ['stringValue1', 'stringValue2', 'stringValue3'],
    },
    meta3: {
      [Op.contains]: [1, 2, 3, 4],
    },
  },
  {
    name: 'a project',
    [Op.or]: [{ id: [1, 2, 3] }, { id: { [Op.gt]: 10 } }],
  },
  {
    id: {
      [Op.or]: [[1, 2, 3], { [Op.gt]: 10 }],
    },
    name: 'a project',
  },
  {
    id: {
      [Op.or]: [[1, 2, 3], { [Op.gt]: 10 }],
    },
    name: 'a project',
  },
  {
    name: 'a project',
    type: {
      [Op.and]: [['a', 'b'], { [Op.notLike]: '%z' }],
    },
  },
  {
    name: 'a project',
    [Op.not]: [{ id: [1, 2, 3] }, { array: { [Op.contains]: [3, 4, 5] } }],
  },
  {
    meta: {
      video: {
        url: {
          [Op.ne]: null,
        },
      },
    },
  },
  {
    'meta.audio.length': {
      [Op.gt]: 20,
    },
  },
  {
    [Op.and]: [{ id: [1, 2, 3] }, { array: { [Op.contains]: [3, 4, 5] } }],
  },
  literal('true'),
  fn('LOWER', 'asd'),
  { [Op.lt]: Sequelize.literal('SOME_STRING') },
]).toMatchTypeOf<WhereOptions[]>();

// Relations / Associations
// Find all projects with a least one task where task.state === project.task
MyModel.findAll({
  include: [
    {
      model: MyModel,
      where: { state: Sequelize.col('project.state') },
    },
  ],
});

{
  const where: WhereOptions = 0 as any;
  MyModel.findOne({
    include: [
      {
        include: [{ model: MyModel, where }],
        model: MyModel,
        where,
      },
    ],
    where,
  });
  MyModel.destroy({ where });
  MyModel.update({ hi: 1 }, { where });

  // Where as having option
  MyModel.findAll({ having: where });
}

// From https://sequelize.org/master/en/v4/docs/models-usage/

async function test() {
  // find multiple entries
  let projects: MyModel[] = await MyModel.findAll();

  // search for specific attributes - hash usage
  projects = await MyModel.findAll({ where: { name: 'A MyModel', enabled: true } });

  // search within a specific range
  projects = await MyModel.findAll({ where: { id: [1, 2, 3] } });

  // locks
  projects = await MyModel.findAll({ lock: Transaction.LOCK.KEY_SHARE });

  // locks on model
  projects = await MyModel.findAll({ lock: { level: Transaction.LOCK.KEY_SHARE, of: MyModel } });
}

MyModel.findAll({
  where: {
    id: {
      // casting here to check a missing operator is not accepted as field name
      [Op.and]: { a: 5 }, // AND (a = 5)
      [Op.or]: [{ a: 5 }, { a: 6 }], // (a = 5 OR a = 6)
      [Op.any]: [2, 3], // ANY ARRAY[2, 3]::INTEGER (PG only)
      [Op.adjacent]: [1, 2],
      [Op.strictLeft]: [1, 2],
      [Op.strictRight]: [1, 2],
      [Op.noExtendLeft]: [1, 2],
      [Op.noExtendRight]: [1, 2],
      [Op.values]: [1, 2],
    } as WhereOperators,
  },
});

const where: WhereOptions = {};
MyModel.findAll({
  where: and(
    where,
    or({ id: 1 }, { id: 2 }),
    and({ id: 1 }, { id: 2 }),
    Sequelize.where(Sequelize.col('col'), Op.eq, null),
    Sequelize.literal('1 = 2'),
  ),
});

MyModel.findAll({
  where: or(
    where,
    or({ id: 1 }, { id: 2 }),
    and({ id: 1 }, { id: 2 }),
    Sequelize.where(Sequelize.col('col'), Op.eq, null),
    Sequelize.literal('1 = 2'),
  ),
});

MyModel.findAll({
  where: {
    [Op.and]: [
      where,
      or({ id: 1 }, { id: 2 }),
      and({ id: 1 }, { id: 2 }),
      Sequelize.where(Sequelize.col('col'), Op.eq, null),
      Sequelize.literal('1 = 2'),
    ],
  },
});

MyModel.findAll({
  where: {
    [Op.or]: [
      where,
      or({ id: 1 }, { id: 2 }),
      and({ id: 1 }, { id: 2 }),
      Sequelize.where(Sequelize.col('col'), Op.eq, null),
      Sequelize.literal('1 = 2'),
    ],
  },
});

MyModel.findAll({
  // implicit "AND"
  where: [
    where,
    or({ id: 1 }, { id: 2 }),
    and({ id: 1 }, { id: 2 }),
    Sequelize.where(Sequelize.col('col'), Op.eq, null),
    Sequelize.literal('1 = 2'),
  ],
});

MyModel.findAll({
  where: {
    id: { [Op.or]: [1, 2] },
  },
});

MyModel.findAll({
  where: {
    id: {
      [Op.or]: {
        [Op.gt]: 1,
        [Op.eq]: 1,
      },
    },
  },
});

MyModel.findAll({
  where: {
    id: {
      [Op.or]: [
        { [Op.gt]: 1 },
        { [Op.eq]: 1 },
      ],
    },
  },
});

// TODO [2022-05-26]: TS < 4.4 reports the error in a different location than 4.4
//  Uncomment test once we remove support for TS 4.3
// MyModel.findAll({
//   where: {
//     id: {
//       [Op.in]: {
//         // @ts-expect-error - cannot use Operator inside another one!
//         [Op.eq]: [1, 2],
//       },
//     },
//   },
// });

MyModel.findAll({
  // @ts-expect-error - no operator
  where: [1, 2],
});

// TODO [2022-05-26]: TS < 4.4 does not detect an error here. Uncomment test once we remove support for TS 4.3
// MyModel.findAll({
//   // @ts-expect-error - no operator
//   where: { [Op.or]: [1, 2] },
// });

// TODO [2022-05-26]: TS < 4.4 does not detect an error here. Uncomment test once we remove support for TS 4.3
// MyModel.findAll({
//   // @ts-expect-error - no operator
//   where: { [Op.and]: { [Op.or]: [1, 2] } },
// });

MyModel.findAll({
  where: {
    [Op.or]: {
      firstName: 'name',
      id: { [Op.gt]: 2 },
    },
  },
});

MyModel.findAll({
  where: {
    [Op.and]: [
      { [Op.or]: { firstName: { [Op.eq]: 2 } } },
    ],
  },
});

MyModel.findAll({
  where: {
    firstName: { [Op.or]: [5, { [Op.eq]: 2 }] },
  },
});

MyModel.findAll({
  where: {
    id: literal('my-literal'),
  },
});

MyModel.findAll({
  where: {
    [Op.or]: [{ id: 1 }, { id: 2 }],
    [Op.and]: [{ id: 1 }, { id: 2 }],
  },
});

MyModel.findAll({
  where: {
    id: {
      [Op.or]: [1, 2],
      [Op.and]: [1, 2],
    },
  },
});

// TODO [2022-05-26]: TS < 4.4 does not detect an error here. Uncomment test once we remove support for TS 4.3
MyModel.findAll({
  where: {
    id: {
      [Op.eq]: {
        // @ts-expect-error - this is not a valid query
        [Op.or]: [1, 2],
      },
    },
  },
});

Sequelize.where(
  Sequelize.cast(Sequelize.col('SOME_COL'), 'INTEGER'),
  {
    [Op.overlap]: Sequelize.literal('LIT'),
  },
);

Sequelize.where(Sequelize.col('ABS'), Op.is, null);

// TODO [>=7]: Sequelize 6 doesn't support Op.col here
// Sequelize.where({ [Op.col]: 'ABS' }, Op.is, null);

Sequelize.where(
  Sequelize.fn('ABS', Sequelize.col('age')),
  Op.like,
  Sequelize.fn('ABS', Sequelize.col('age')),
);

Sequelize.where(Sequelize.col('ABS'), null);
Sequelize.where(Sequelize.literal('first_name'), null);

Sequelize.where(Sequelize.col('ABS'), Sequelize.and(
  { [Op.iLike]: 'abs' },
  { [Op.not]: { [Op.eq]: 'ABS' } },
));

Sequelize.where(Sequelize.col('ABS'), Sequelize.or(
  { [Op.iLike]: 'abs' },
  { [Op.not]: { [Op.eq]: 'ABS' } },
));

Sequelize.where(Sequelize.col('ABS'), { [Op.not]: true });
