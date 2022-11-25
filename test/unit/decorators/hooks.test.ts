import { Model } from '@sequelize/core';
import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-typescript.js';
import {
  AfterBulkCreate,
  AfterBulkDestroy,
  AfterBulkRestore,
  AfterBulkUpdate,
  AfterCreate,
  AfterDestroy,
  AfterFind,
  AfterRestore,
  AfterSave,
  AfterUpdate,
  AfterUpsert,
  AfterValidate,
  BeforeBulkCreate,
  BeforeBulkDestroy,
  BeforeBulkRestore,
  BeforeBulkUpdate,
  BeforeCount,
  BeforeCreate,
  BeforeDestroy,
  BeforeFind,
  BeforeFindAfterExpandIncludeAll,
  BeforeFindAfterOptions,
  BeforeRestore,
  BeforeSave,
  BeforeUpdate,
  BeforeUpsert,
  BeforeValidate,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';

// map of hook name to hook decorator
const hookMap: Partial<Record<keyof ModelHooks, Function>> = {
  afterBulkCreate: AfterBulkCreate,
  afterBulkDestroy: AfterBulkDestroy,
  afterBulkRestore: AfterBulkRestore,
  afterBulkUpdate: AfterBulkUpdate,
  afterCreate: AfterCreate,
  afterDestroy: AfterDestroy,
  afterFind: AfterFind,
  afterRestore: AfterRestore,
  afterSave: AfterSave,
  afterUpdate: AfterUpdate,
  afterUpsert: AfterUpsert,
  afterValidate: AfterValidate,
  beforeBulkCreate: BeforeBulkCreate,
  beforeBulkDestroy: BeforeBulkDestroy,
  beforeBulkRestore: BeforeBulkRestore,
  beforeBulkUpdate: BeforeBulkUpdate,
  beforeCount: BeforeCount,
  beforeCreate: BeforeCreate,
  beforeDestroy: BeforeDestroy,
  beforeFind: BeforeFind,
  beforeFindAfterExpandIncludeAll: BeforeFindAfterExpandIncludeAll,
  beforeFindAfterOptions: BeforeFindAfterOptions,
  beforeRestore: BeforeRestore,
  beforeSave: BeforeSave,
  beforeUpdate: BeforeUpdate,
  beforeUpsert: BeforeUpsert,
  beforeValidate: BeforeValidate,
};

describe('@Hook decorators', () => {
  it('adds a hook on the current model', () => {
    for (const [hookName, decorator] of Object.entries(hookMap)) {
      const symbol = Symbol('secret');

      class MyModel extends Model {
        @decorator
        static myHook() {
          return symbol;
        }
      }

      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(true, `hook ${hookName} incorrectly registered its hook`);
    }
  });
});
