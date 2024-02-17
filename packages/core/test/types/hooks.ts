import { expectTypeOf } from 'expect-type';
import type {
  Attributes,
  ConnectionOptions,
  FindOptions,
  ModelStatic,
  QueryOptions,
  SaveOptions,
  UpsertOptions,
} from '@sequelize/core';
import { Model, Sequelize } from '@sequelize/core';
import type {
  AfterAssociateEventData,
  AssociationOptions,
  BeforeAssociateEventData,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/associations';
import type {
  Connection,
  GetConnectionOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/connection-manager.js';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
import type { ValidationOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/instance-validator';
import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-hooks.js';
import type { SequelizeHooks } from '../../types/sequelize-typescript.js';
import type { SemiDeepWritable } from './type-helpers/deep-writable';

{
  class TestModel extends Model {}

  const commonHooks = {
    validationFailed(instance, options, error) {
      expectTypeOf(instance).toEqualTypeOf<TestModel>();
      expectTypeOf(options).toEqualTypeOf<ValidationOptions>();
      expectTypeOf(error).toEqualTypeOf<unknown>();
    },
    beforeSave(instance, options) {
      expectTypeOf(instance).toEqualTypeOf<TestModel>();
      expectTypeOf(options).toMatchTypeOf<SaveOptions>(); // TODO consider `.toEqualTypeOf` instead ?
    },
    afterSave(instance, options) {
      expectTypeOf(instance).toEqualTypeOf<TestModel>();
      expectTypeOf(options).toMatchTypeOf<SaveOptions>(); // TODO consider `.toEqualTypeOf` instead ?
    },
    beforeAssociate(data, options) {
      expectTypeOf(data).toEqualTypeOf<BeforeAssociateEventData>();
      expectTypeOf(options).toEqualTypeOf<AssociationOptions<any>>();
    },
    afterAssociate(data, options) {
      expectTypeOf(data).toEqualTypeOf<AfterAssociateEventData>();
      expectTypeOf(options).toEqualTypeOf<AssociationOptions<any>>();
    },
  } as const satisfies Partial<ModelHooks<TestModel, Attributes<TestModel>>>;

  const modelHooks = {
    ...commonHooks,
    beforeUpsert(data, options) {
      expectTypeOf(data).toEqualTypeOf<Attributes<TestModel>>();
      expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
    },
    afterUpsert(output, options) {
      expectTypeOf(output).toEqualTypeOf<[ TestModel, boolean | null ]>();
      expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
    },
    afterFind(results, options) {
      expectTypeOf(results).toEqualTypeOf<readonly TestModel[] | TestModel | null>();
      expectTypeOf(options).toEqualTypeOf<FindOptions>();
    },
  } as const satisfies Partial<ModelHooks<TestModel, Attributes<TestModel>>>;

  const sequelizeHooks = {
    ...commonHooks,
    beforeUpsert(model, data, options) {
      expectTypeOf(model).toEqualTypeOf<ModelStatic>();
      expectTypeOf(data).toEqualTypeOf<Attributes<TestModel>>();
      expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
    },
    afterUpsert(model, output, options) {
      expectTypeOf(model).toEqualTypeOf<ModelStatic>();
      expectTypeOf(output).toEqualTypeOf<[ TestModel, boolean | null ]>();
      expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
    },
    afterFind(model, output, options) {
      expectTypeOf(model).toEqualTypeOf<ModelStatic>();
      expectTypeOf(output).toEqualTypeOf<readonly TestModel[] | TestModel | null>();
      expectTypeOf(options).toEqualTypeOf<FindOptions>();
    },
  } as const satisfies Partial<SequelizeHooks>;

  const sequelize = new Sequelize('uri', { hooks: sequelizeHooks });
  TestModel.init({}, { sequelize, hooks: modelHooks });

  TestModel.addHook('beforeSave', modelHooks.beforeSave);
  TestModel.addHook('afterSave', modelHooks.afterSave);
  TestModel.addHook('afterFind', modelHooks.afterFind);
  TestModel.addHook('beforeUpsert', modelHooks.beforeUpsert);
  TestModel.addHook('afterUpsert', modelHooks.afterUpsert);

  TestModel.beforeSave(modelHooks.beforeSave);
  TestModel.afterSave(modelHooks.afterSave);
  TestModel.afterFind(modelHooks.afterFind);

  sequelize.beforeSave(sequelizeHooks.beforeSave);
  sequelize.afterSave(sequelizeHooks.afterSave);
  sequelize.afterFind(sequelizeHooks.afterFind);
  sequelize.afterFind('namedAfterFind', sequelizeHooks.afterFind);
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

  hooks.beforeUpsert = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };
}

const sequelize = new Sequelize();

sequelize.beforeConnect('name', (config: ConnectionOptions) => {
  expectTypeOf(config).toMatchTypeOf<ConnectionOptions>();
});

sequelize.beforeConnect((config: ConnectionOptions) => {
  expectTypeOf(config).toMatchTypeOf<ConnectionOptions>();
});

sequelize.addHook('beforeConnect', (...args) => {
  expectTypeOf(args).toMatchTypeOf<[ConnectionOptions]>();
});

sequelize.beforePoolAcquire('name', (options?: GetConnectionOptions) => {
  expectTypeOf(options).toMatchTypeOf<GetConnectionOptions | undefined>();
});

sequelize.beforePoolAcquire((options?: GetConnectionOptions) => {
  expectTypeOf(options).toMatchTypeOf<GetConnectionOptions | undefined>();
});

sequelize.addHook('beforePoolAcquire', (...args: [GetConnectionOptions | undefined]) => {
  expectTypeOf(args).toMatchTypeOf<[GetConnectionOptions | undefined]>();
});

sequelize.afterPoolAcquire('name', (connection: Connection, options?: GetConnectionOptions) => {
  expectTypeOf(connection).toMatchTypeOf<Connection>();
  expectTypeOf(options).toMatchTypeOf<GetConnectionOptions | undefined>();
});

sequelize.afterPoolAcquire((connection: Connection, options?: GetConnectionOptions) => {
  expectTypeOf(connection).toMatchTypeOf<Connection>();
  expectTypeOf(options).toMatchTypeOf<GetConnectionOptions | undefined>();
});

sequelize.addHook('afterPoolAcquire', (...args: [Connection | GetConnectionOptions | undefined]) => {
  expectTypeOf(args).toMatchTypeOf<[Connection | GetConnectionOptions | undefined]>();
});

sequelize.beforeQuery((options, query) => {
  expectTypeOf(options).toEqualTypeOf<QueryOptions>();
  expectTypeOf(query).toEqualTypeOf<AbstractQuery>();
});

sequelize.beforeQuery((...args) => {
  expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
});

sequelize.afterQuery((options, query) => {
  expectTypeOf(options).toEqualTypeOf<QueryOptions>();
  expectTypeOf(query).toEqualTypeOf<AbstractQuery>();
});

sequelize.beforeBulkSync((...args) => {
  expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
});
