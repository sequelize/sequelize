import type { Attributes, InferAttributes, WhereOptions } from '@sequelize/core';
import { Model, Op, Sequelize, Transaction, and, or } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';

// NOTE: most typing tests for WhereOptions are located in test/unit/sql/where.test.ts

class MyModel extends Model<InferAttributes<MyModel>> {
  declare id: number;
  declare hi: number;
  declare name: string;
  declare groupId: number | null;
}

// Optional values
expectTypeOf<{ needed: number; optional?: number }>().toMatchTypeOf<WhereOptions>();

{
  // @ts-expect-error -- cannot use column references in Op.any
  const a: WhereOptions<MyModel> = { hi: { [Op.eq]: { [Op.any]: [Sequelize.col('SOME_COL')] } } };

  // @ts-expect-error -- cannot use column references in Op.any
  const b: WhereOptions<MyModel> = { hi: { [Op.eq]: { [Op.all]: [Sequelize.col('SOME_COL')] } } };
}

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
  const where: WhereOptions<Attributes<MyModel>> = 0 as any;
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

async function test() {
  // find multiple entries
  let projects: MyModel[] = await MyModel.findAll();

  // search for specific attributes - hash usage
  projects = await MyModel.findAll({ where: { name: 'A MyModel', groupId: null } });

  // search within a specific range
  projects = await MyModel.findAll({ where: { id: [1, 2, 3] } });

  // locks
  projects = await MyModel.findAll({ lock: Transaction.LOCK.KEY_SHARE });

  // locks on model
  projects = await MyModel.findAll({ lock: { level: Transaction.LOCK.KEY_SHARE, of: MyModel } });
}

// From https://sequelize.org/master/en/v4/docs/models-usage/

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
    id: {
      [Op.in]: {
        // @ts-expect-error -- cannot use Operator inside another one!
        [Op.eq]: [1, 2],
      },
    },
  },
});

// @ts-expect-error -- no attribute
MyModel.findAll({
  where: [1, 2],
});

MyModel.findAll({
  // @ts-expect-error -- no attribute
  where: { [Op.or]: [1, 2] },
});

MyModel.findAll({
  // @ts-expect-error -- no attribute
  where: { [Op.and]: { [Op.or]: [1, 2] } },
});

MyModel.findAll({
  where: {
    id: {
      [Op.eq]: {
        // @ts-expect-error -- this is not a valid query
        [Op.or]: [1, 2],
      },
    },
  },
});
