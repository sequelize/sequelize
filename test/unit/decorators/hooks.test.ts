import { Model } from '@sequelize/core';
import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-typescript.js';
import {
  AfterAssociate,
  AfterBulkCreate,
  AfterBulkDestroy,
  AfterBulkRestore,
  AfterBulkUpdate,
  AfterCreate,
  AfterDestroy,
  AfterFind,
  AfterRestore,
  AfterSave,
  AfterSync,
  AfterUpdate,
  AfterUpsert,
  AfterValidate,
  BeforeAssociate,
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
  BeforeSync,
  BeforeUpdate,
  BeforeUpsert,
  BeforeValidate,
  ValidationFailed,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';

// map of hook name to hook decorator
const hookMap: Partial<Record<keyof ModelHooks, Function>> = {
  afterAssociate: AfterAssociate,
  afterBulkCreate: AfterBulkCreate,
  afterBulkDestroy: AfterBulkDestroy,
  afterBulkRestore: AfterBulkRestore,
  afterBulkUpdate: AfterBulkUpdate,
  afterCreate: AfterCreate,
  afterDestroy: AfterDestroy,
  afterFind: AfterFind,
  afterRestore: AfterRestore,
  afterSave: AfterSave,
  afterSync: AfterSync,
  afterUpdate: AfterUpdate,
  afterUpsert: AfterUpsert,
  afterValidate: AfterValidate,
  beforeAssociate: BeforeAssociate,
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
  beforeSync: BeforeSync,
  beforeUpdate: BeforeUpdate,
  beforeUpsert: BeforeUpsert,
  beforeValidate: BeforeValidate,
  validationFailed: ValidationFailed,
};

for (const [hookName, decorator] of Object.entries(hookMap)) {
  describe(`@${hookName} legacy decorator`, () => {
    it('adds a hook on the current model', () => {
      class MyModel extends Model {
        @decorator
        static myHook() {}
      }

      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(true, `hook ${hookName} incorrectly registered its hook`);
    });

    it('supports a "name" option', () => {
      class MyModel extends Model {
        @decorator({ name: 'my-hook' })
        static myHook() {}
      }

      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(true, `hook ${hookName} incorrectly registered its hook`);
      MyModel.removeHook(hookName as keyof ModelHooks, 'my-hook');
      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(false, `hook ${hookName} should be possible to remove by name`);
    });

    it('throws on non-static hooks', () => {
      expect(() => {
        class MyModel extends Model {
          @decorator
          nonStaticMethod() {}
        }

        return MyModel;
      }).to.throw(Error, /Only static methods can be used for hooks/);
    });

    it('throws on non-method properties', () => {
      expect(() => {
        class MyModel extends Model {
          @decorator
          static nonMethod = 'abc';
        }

        return MyModel;
      }).to.throw(Error, /is not a method/);
    });

    it('throws if the class is not a model', () => {
      expect(() => {
        class MyModel {
          @decorator
          static nonStaticMethod() {}
        }

        return MyModel;
      }).to.throw(Error, /Hook decorators can only be used on models/);
    });

    it('throws on reserved methods', () => {
      expect(() => {
        // @ts-expect-error -- replacing an existing method
        class MyModel extends Model {
          @decorator
          static sync() {}
        }

        return MyModel;
      }).to.throw(Error, /already exists on the base Model/);
    });
  });
}
