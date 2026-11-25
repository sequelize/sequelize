import type { Attributes, Model, UnionRow } from '@sequelize/core';
import { sql } from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import { sequelize } from './connection';
import { User } from './models/user';
import { UserPost } from './models/user-post';

(async () => {
  {
    const rows = await sequelize.union([{ model: User }, { model: UserPost }]);

    // Plain objects, never model instances: a UNION can mix rows from different models.
    expectTypeOf(rows).toEqualTypeOf<Array<UnionRow<User>>>();
    expectTypeOf(rows).not.toEqualTypeOf<User[]>();
    expectTypeOf(rows[0]).not.toMatchTypeOf<Model>();

    // The known keys come from the first member query, as the result column names do.
    expectTypeOf(rows[0].firstName).toEqualTypeOf<Attributes<User>['firstName'] | undefined>();

    // @ts-expect-error -- union rows are not model instances, so they have no instance methods
    rows[0].toJSON();
  }

  {
    // Aliased attributes are not attributes of the model, so they are reachable but untyped.
    const rows = await sequelize.union([
      { model: User, options: { attributes: [['firstName', 'name']] } },
      { model: UserPost, options: { attributes: [['title', 'name']] } },
    ]);

    expectTypeOf(rows[0].name).toEqualTypeOf<unknown>();
  }

  // Options of the combined result set.
  await sequelize.union([{ model: User }], {
    unionAll: true,
    order: ['firstName', ['firstName', 'DESC'], sql.literal('1')],
    limit: 10,
    offset: 5,
  });

  await sequelize.union([{ model: User }], {
    // @ts-expect-error -- the order of a union must be an array
    order: 'firstName',
  });

  await sequelize.union([{ model: User }], {
    // @ts-expect-error -- 'DESCC' is not a valid order direction
    order: [['firstName', 'DESCC']],
  });

  // Member queries accept the options of `Model.findAll`...
  await sequelize.union([
    { model: User, options: { where: { firstName: 'John' }, attributes: ['firstName'] } },
  ]);

  // ...except for the four that a UNION member cannot support.
  await sequelize.union([
    // @ts-expect-error -- eager-loading is not supported in a UNION
    { model: User, options: { include: 'group' } },
  ]);

  await sequelize.union([
    // @ts-expect-error -- a UNION member may not be limited; use the union-level "limit" instead
    { model: User, options: { limit: 10 } },
  ]);

  await sequelize.union([
    // @ts-expect-error -- a UNION member may not be offset; use the union-level "offset" instead
    { model: User, options: { offset: 10 } },
  ]);

  await sequelize.union([
    // @ts-expect-error -- a UNION member may not be ordered; use the union-level "order" instead
    { model: User, options: { order: ['firstName'] } },
  ]);
})();
