import type {
  AbstractConnection,
  AcquireConnectionOptions,
  ConnectionOptions,
  FindOptions,
  QueryOptions,
  SaveOptions,
  UpsertOptions,
} from '@sequelize/core';
import { Model, Sequelize } from '@sequelize/core';
import type { AbstractQuery } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query.js';
import type {
  AfterAssociateEventData,
  AssociationOptions,
  BeforeAssociateEventData,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/associations/index.js';
import type { ValidationOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/instance-validator.js';
import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-hooks.js';
import { MySqlDialect } from '@sequelize/mysql';
import { expectTypeOf } from 'expect-type';
import type { SemiDeepWritable } from './type-helpers/deep-writable';

{
  class TestModel extends Model {}

  const hooks: Partial<ModelHooks<TestModel>> = {
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
      expectTypeOf(m).toEqualTypeOf<[TestModel, boolean | null]>();
      expectTypeOf(options).toEqualTypeOf<UpsertOptions>();
    },
    beforeAssociate(data, options) {
      expectTypeOf(data).toEqualTypeOf<BeforeAssociateEventData>();
      expectTypeOf(options).toEqualTypeOf<AssociationOptions<any>>();
    },
    afterAssociate(data, options) {
      expectTypeOf(data).toEqualTypeOf<AfterAssociateEventData>();
      expectTypeOf(options).toEqualTypeOf<AssociationOptions<any>>();
    },
  };

  const sequelize = new Sequelize({ dialect: MySqlDialect, hooks });
  TestModel.init({}, { sequelize, hooks });

  TestModel.addHook('beforeSave', hooks.beforeSave!);
  TestModel.addHook('afterSave', hooks.afterSave!);
  TestModel.addHook('afterFind', hooks.afterFind!);
  TestModel.addHook('beforeUpsert', hooks.beforeUpsert!);
  TestModel.addHook('afterUpsert', hooks.afterUpsert!);

  TestModel.beforeSave(hooks.beforeSave!);
  TestModel.afterSave(hooks.afterSave!);
  TestModel.afterFind(hooks.afterFind!);

  sequelize.beforeSave(hooks.beforeSave!);
  sequelize.afterSave(hooks.afterSave!);
  sequelize.afterFind(hooks.afterFind!);
  sequelize.afterFind('namedAfterFind', hooks.afterFind!);
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

  // hooks.beforeFind = (...args) => {
  //   expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  // };
  //
  // hooks.beforeCount = (...args) => {
  //   expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  // };
  //
  // hooks.beforeFindAfterExpandIncludeAll = (...args) => {
  //   expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  // };
  //
  // hooks.beforeFindAfterOptions = (...args) => {
  //   expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  // };

  hooks.beforeSync = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };

  hooks.beforeUpsert = (...args) => {
    expectTypeOf(args).toEqualTypeOf<SemiDeepWritable<typeof args>>();
  };
}

const sequelize = new Sequelize({ dialect: MySqlDialect });

sequelize.beforeConnect('name', (config: ConnectionOptions<MySqlDialect>) => {
  expectTypeOf(config).toMatchTypeOf<ConnectionOptions<MySqlDialect>>();
});

sequelize.beforeConnect((config: ConnectionOptions<MySqlDialect>) => {
  expectTypeOf(config).toMatchTypeOf<ConnectionOptions<MySqlDialect>>();
});

sequelize.addHook('beforeConnect', (...args) => {
  expectTypeOf(args).toMatchTypeOf<[ConnectionOptions<MySqlDialect>]>();
});

sequelize.beforePoolAcquire('name', (options?: AcquireConnectionOptions) => {
  expectTypeOf(options).toMatchTypeOf<AcquireConnectionOptions | undefined>();
});

sequelize.beforePoolAcquire((options?: AcquireConnectionOptions) => {
  expectTypeOf(options).toMatchTypeOf<AcquireConnectionOptions | undefined>();
});

sequelize.addHook('beforePoolAcquire', (...args: [AcquireConnectionOptions | undefined]) => {
  expectTypeOf(args).toMatchTypeOf<[AcquireConnectionOptions | undefined]>();
});

sequelize.afterPoolAcquire(
  'name',
  (connection: AbstractConnection, options?: AcquireConnectionOptions) => {
    expectTypeOf(connection).toMatchTypeOf<AbstractConnection>();
    expectTypeOf(options).toMatchTypeOf<AcquireConnectionOptions | undefined>();
  },
);

sequelize.afterPoolAcquire((connection: AbstractConnection, options?: AcquireConnectionOptions) => {
  expectTypeOf(connection).toMatchTypeOf<AbstractConnection>();
  expectTypeOf(options).toMatchTypeOf<AcquireConnectionOptions | undefined>();
});

sequelize.addHook(
  'afterPoolAcquire',
  (...args: [AbstractConnection | AcquireConnectionOptions | undefined]) => {
    expectTypeOf(args).toMatchTypeOf<[AbstractConnection | AcquireConnectionOptions | undefined]>();
  },
);

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
