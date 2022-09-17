import type { FindOptions, QueryOptions, SaveOptions, UpsertOptions, Config, Utils, ValidationOptions } from '@sequelize/core';
import { Model, Sequelize } from '@sequelize/core';
import type {
  BeforeAssociateEventData,
  AfterAssociateEventData,
  AssociationOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/associations';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/hooks.js';
import { expectTypeOf } from 'expect-type';
import type { SemiDeepWritable } from './type-helpers/deep-writable';

{
  class TestModel extends Model {}

  const hooks: Partial<ModelHooks> = {
    validationFailed(m, options, error) {
      expectTypeOf(m).toEqualTypeOf<TestModel>();
      expectTypeOf(options).toEqualTypeOf<ValidationOptions>();
      expectTypeOf(error).toEqualTypeOf<unknown>();
    },
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
      expectTypeOf(m).toEqualTypeOf<[ TestModel, boolean | null ]>();
      expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
    },
    beforeQuery(options, query) {
      expectTypeOf(options).toEqualTypeOf<QueryOptions>();
      expectTypeOf(query).toEqualTypeOf<AbstractQuery>();
    },
    afterQuery(options, query) {
      expectTypeOf(options).toEqualTypeOf<QueryOptions>();
      expectTypeOf(query).toEqualTypeOf<AbstractQuery>();
    },
    beforeAssociate(data, options) {
      expectTypeOf(data).toEqualTypeOf<BeforeAssociateEventData>();
      expectTypeOf(options).toEqualTypeOf<AssociationOptions>();
    },
    afterAssociate(data, options) {
      expectTypeOf(data).toEqualTypeOf<BeforeAssociateEventData>();
      expectTypeOf(options).toEqualTypeOf<AssociationOptions>();
    },
  };

  const sequelize = new Sequelize('uri', { hooks });
  TestModel.init({}, { sequelize, hooks });

  TestModel.addHook('beforeSave', hooks.beforeSave!);
  TestModel.addHook('afterSave', hooks.afterSave!);
  TestModel.addHook('afterFind', hooks.afterFind!);
  TestModel.addHook('beforeUpsert', hooks.beforeUpsert!);
  TestModel.addHook('afterUpsert', hooks.afterUpsert!);

  TestModel.beforeSave(hooks.beforeSave!);
  TestModel.afterSave(hooks.afterSave!);
  TestModel.afterFind(hooks.afterFind!);

  Sequelize.beforeSave(hooks.beforeSave!);
  Sequelize.afterSave(hooks.afterSave!);
  Sequelize.afterFind(hooks.afterFind!);
  Sequelize.afterFind('namedAfterFind', hooks.afterFind!);
}

// #12959
{
  const hooks: ModelHooks = 0 as any;

  hooks.beforeValidate = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeCreate = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeDestroy = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeRestore = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeUpdate = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeSave = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeBulkCreate = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeBulkDestroy = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeBulkRestore = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeBulkUpdate = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeFind = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeCount = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeFindAfterExpandIncludeAll = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeFindAfterOptions = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeSync = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeBulkSync = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeQuery = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeUpsert = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };
}

Sequelize.beforeConnect('name', config => expectTypeOf(config).toEqualTypeOf<Utils.DeepWriteable<Config>>());
Sequelize.beforeConnect(config => expectTypeOf(config).toEqualTypeOf<Utils.DeepWriteable<Config>>());
Sequelize.addHook('beforeConnect', (...args) => {
  expectTypeOf(args).toEqualTypeOf<[Utils.DeepWriteable<Config>]>();
});
