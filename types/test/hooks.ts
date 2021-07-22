import { expectTypeOf } from "expect-type";
import { Model, SaveOptions, Sequelize, FindOptions, UpsertOptions } from "sequelize";
import { ModelHooks } from "../lib/hooks";

class TestModel extends Model {}

/*
 * covers types/lib/hooks.d.ts
 */

const hooks: Partial<ModelHooks> = {
  beforeSave(m, options) {
    expectTypeOf(m).toEqualTypeOf<TestModel>();
    expectTypeOf(options).toMatchTypeOf<SaveOptions>(); // TODO consider `.toEqualTypeOf` instead ?
  },
  afterSave(m, options) {
    expectTypeOf(m).toEqualTypeOf<TestModel>();
    expectTypeOf(options).toMatchTypeOf<SaveOptions>(); // TODO consider `.toEqualTypeOf` instead ?
  },
  afterFind(m, options) {
    expectTypeOf(m).toEqualTypeOf<readonly TestModel[] | TestModel | null>();
    expectTypeOf(options).toEqualTypeOf<FindOptions>();
  },
  beforeUpsert(m, options) {
    expectTypeOf(m).toEqualTypeOf<TestModel>();
    expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
  },
  afterUpsert(m, options) {
    expectTypeOf(m).toEqualTypeOf<TestModel>();
    expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
  },
};

export const sequelize = new Sequelize('uri', { hooks });
TestModel.init({}, { sequelize, hooks });

TestModel.addHook('beforeSave', hooks.beforeSave!);
TestModel.addHook('afterSave', hooks.afterSave!);
TestModel.addHook('afterFind', hooks.afterFind!);
TestModel.addHook('beforeUpsert', hooks.beforeUpsert!);
TestModel.addHook('afterUpsert', hooks.afterUpsert!);

/*
 * covers types/lib/model.d.ts
 */

TestModel.beforeSave(hooks.beforeSave!);
TestModel.afterSave(hooks.afterSave!);
TestModel.afterFind(hooks.afterFind!);

/*
 * covers types/lib/sequelize.d.ts
 */

Sequelize.beforeSave(hooks.beforeSave!);
Sequelize.afterSave(hooks.afterSave!);
Sequelize.afterFind(hooks.afterFind!);
Sequelize.afterFind('namedAfterFind', hooks.afterFind!);
