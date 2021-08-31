import { expectTypeOf } from "expect-type";
import { AndOperator, fn, Model, Op, OrOperator, Sequelize, WhereOperators, WhereOptions, literal, where as whereFn } from 'sequelize';
import Transaction from '../lib/transaction';

class MyModel extends Model {
  public hi!: number;
}

// Simple options

expectTypeOf({
  string: 'foo',
  strings: ['foo'],
  number: 1,
  numbers: [1],
  boolean: true,
  buffer: Buffer.alloc(0),
  buffers: [Buffer.alloc(0)],
  null: null,
  date: new Date()
}).toMatchTypeOf<WhereOptions>();

// Optional values
expectTypeOf<{ needed: number; optional?: number }>().toMatchTypeOf<WhereOptions>();

// Misusing optional values (typings allow this, sequelize will throw an error during runtime)
// This might be solved by updates to typescript itself (https://github.com/microsoft/TypeScript/issues/13195)
// expectTypeOf({ needed: 2, optional: undefined }).not.toMatchTypeOf<WhereOptions>();

// Operators

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

expectTypeOf({
  [Op.gt]: 6, // > 6
  [Op.gte]: 6, // >= 6
  [Op.lt]: 10, // < 10
  [Op.lte]: 10, // <= 10
  [Op.ne]: 20, // != 20
  [Op.not]: true, // IS NOT TRUE
  [Op.between]: [6, 10], // BETWEEN 6 AND 10
  [Op.notBetween]: [11, 15], // NOT BETWEEN 11 AND 15
  [Op.in]: [1, 2], // IN [1, 2]
  [Op.notIn]: [1, 2], // NOT IN [1, 2]
  [Op.like]: '%hat', // LIKE '%hat'
  [Op.notLike]: '%hat', // NOT LIKE '%hat'
  [Op.iLike]: '%hat', // ILIKE '%hat' (case insensitive) (PG only)
  [Op.notILike]: '%hat', // NOT ILIKE '%hat'  (PG only)
  [Op.startsWith]: 'hat',
  [Op.endsWith]: 'hat',
  [Op.substring]: 'hat',
  [Op.overlap]: [1, 2], // && [1, 2] (PG array overlap operator)
  [Op.contains]: [1, 2], // @> [1, 2] (PG array contains operator)
  [Op.contained]: [1, 2], // <@ [1, 2] (PG array contained by operator)
  [Op.any]: [2, 3], // ANY ARRAY[2, 3]::INTEGER (PG only)
  [Op.regexp]: '^[h|a|t]', // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
  [Op.notRegexp]: '^[h|a|t]', // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
  [Op.iRegexp]: '^[h|a|t]',  // ~* '^[h|a|t]' (PG only)
  [Op.notIRegexp]: '^[h|a|t]' // !~* '^[h|a|t]' (PG only)
} as const).toMatchTypeOf<WhereOperators>();

expectTypeOf({
  [Op.like]: { [Op.any]: ['cat', 'hat'] }, // LIKE ANY ARRAY['cat', 'hat']
  [Op.iLike]: { [Op.any]: ['cat', 'hat'] }, // LIKE ANY ARRAY['cat', 'hat']
  [Op.notLike]: { [Op.any]: ['cat', 'hat'] }, // LIKE ANY ARRAY['cat', 'hat']
  [Op.notILike]: { [Op.any]: ['cat', 'hat'] }, // LIKE ANY ARRAY['cat', 'hat']
}).toMatchTypeOf<WhereOperators>();

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
    }
  },
  {
    [Op.or]: [
      { title: { [Op.like]: 'Boat%' } },
      { description: { [Op.like]: '%boat%' } }
    ]
  },
  {
    meta: {
      [Op.contains]: {
        site: {
          url: 'https://sequelize.org/'
        }
      }
    },
    meta2: {
      [Op.contains]: ['stringValue1', 'stringValue2', 'stringValue3']
    },
    meta3: {
      [Op.contains]: [1, 2, 3, 4]
    },
  },
  {
    name: 'a project',
    [Op.or]: [{ id: [1, 2, 3] }, { id: { [Op.gt]: 10 } }]
  },
  {
    id: {
      [Op.or]: [[1, 2, 3], { [Op.gt]: 10 }]
    },
    name: 'a project'
  },
  {
    id: {
      [Op.or]: [[1, 2, 3], { [Op.gt]: 10 }]
    },
    name: 'a project'
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
  {
    [Op.gt]: fn('NOW'),
  },
  whereFn('test', { [Op.gt]: new Date() }),
  literal('true'),
  fn('LOWER', 'asd'),
  { [Op.lt]: Sequelize.literal('SOME_STRING') }
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
  projects = await MyModel.findAll({ where: { name: 'A MyModel', enabled: true } })

  // search within a specific range
  projects = await MyModel.findAll({ where: { id: [1, 2, 3] } });

  // locks
  projects = await MyModel.findAll({ lock: Transaction.LOCK.KEY_SHARE });

  // locks on model
  projects = await MyModel.findAll({ lock: { level: Transaction.LOCK.KEY_SHARE, of: MyModel} });
}

MyModel.findAll({
  where: {
    id: {
      // casting here to check a missing operator is not accepted as field name
      [Op.and]: { a: 5 }, // AND (a = 5)
      [Op.or]: [{ a: 5 }, { a: 6 }], // (a = 5 OR a = 6)
      [Op.gt]: 6, // id > 6
      [Op.gte]: 6, // id >= 6
      [Op.lt]: 10, // id < 10
      [Op.lte]: 10, // id <= 10
      [Op.ne]: 20, // id != 20
      [Op.between]: [6, 10] || [new Date(), new Date()], // BETWEEN 6 AND 10
      [Op.notBetween]: [11, 15], // NOT BETWEEN 11 AND 15
      [Op.in]: [1, 2], // IN [1, 2]
      [Op.notIn]: [1, 2], // NOT IN [1, 2]
      [Op.like]: '%hat', // LIKE '%hat'
      [Op.notLike]: '%hat', // NOT LIKE '%hat'
      [Op.iLike]: '%hat', // ILIKE '%hat' (case insensitive)  (PG only)
      [Op.notILike]: '%hat', // NOT ILIKE '%hat'  (PG only)
      [Op.overlap]: [1, 2], // && [1, 2] (PG array overlap operator)
      [Op.contains]: [1, 2], // @> [1, 2] (PG array contains operator)
      [Op.contained]: [1, 2], // <@ [1, 2] (PG array contained by operator)
      [Op.any]: [2, 3], // ANY ARRAY[2, 3]::INTEGER (PG only)
      [Op.adjacent]: [1, 2],
      [Op.strictLeft]: [1, 2],
      [Op.strictRight]: [1, 2],
      [Op.noExtendLeft]: [1, 2],
      [Op.noExtendRight]: [1, 2],
      [Op.values]: [1, 2],
    } as WhereOperators,
    status: {
      [Op.not]: false, // status NOT FALSE
    },
  },
});

Sequelize.where(
  Sequelize.cast(Sequelize.col('SOME_COL'), 'INTEGER'), {
    [Op.lt]: Sequelize.literal('LIT'),
    [Op.any]: Sequelize.literal('LIT'),
    [Op.gte]: Sequelize.literal('LIT'),
    [Op.lt]: Sequelize.literal('LIT'),
    [Op.lte]: Sequelize.literal('LIT'),
    [Op.ne]: Sequelize.literal('LIT'),
    [Op.not]: Sequelize.literal('LIT'),
    [Op.in]: Sequelize.literal('LIT'),
    [Op.notIn]: Sequelize.literal('LIT'),
    [Op.like]: Sequelize.literal('LIT'),
    [Op.notLike]: Sequelize.literal('LIT'),
    [Op.iLike]: Sequelize.literal('LIT'),
    [Op.overlap]: Sequelize.literal('LIT'),
    [Op.contains]: Sequelize.literal('LIT'),
    [Op.contained]: Sequelize.literal('LIT'),
    [Op.gt]: Sequelize.literal('LIT'),
    [Op.notILike]: Sequelize.literal('LIT'),
  }
)

Sequelize.where(Sequelize.col("ABS"), Op.is, null);

Sequelize.where(
  Sequelize.fn("ABS", Sequelize.col("age")),
  Op.like,
  Sequelize.fn("ABS", Sequelize.col("age"))
);

Sequelize.where(Sequelize.col("ABS"), null);
