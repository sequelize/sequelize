import type { ModelHooks } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-hooks.js';
import { expect } from 'chai';
import { Model } from '@sequelize/core';
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
  BeforeDefinitionRefresh,
  AfterDefinitionRefresh,
} from '@sequelize/core/decorators-legacy';
import { sequelize } from '../../support';

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
  beforeDefinitionRefresh: BeforeDefinitionRefresh,
  afterDefinitionRefresh: AfterDefinitionRefresh,
};

for (const [hookName, decorator] of Object.entries(hookMap)) {
  describe(`@${hookName} legacy decorator`, () => {
    it('adds a hook on the current model', () => {
      class MyModel extends Model {
        @decorator
        static myHook() {}
      }

      sequelize.addModels([MyModel]);

      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(true, `hook ${hookName} incorrectly registered its hook`);
    });

    it('supports a "name" option', () => {
      class MyModel extends Model {
        @decorator({ name: 'my-hook' })
        static myHook() {}
      }

      sequelize.addModels([MyModel]);

      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(true, `hook ${hookName} incorrectly registered its hook`);
      const hookCount = MyModel.hooks.getListenerCount(hookName as keyof ModelHooks);

      MyModel.removeHook(hookName as keyof ModelHooks, 'my-hook');

      const newHookCount = MyModel.hooks.getListenerCount(hookName as keyof ModelHooks);

      expect(newHookCount).to.eq(hookCount - 1, `hook ${hookName} should be possible to remove by name`);
    });

    it('supports symbol methods', () => {
      class MyModel extends Model {
        @decorator
        static [Symbol('myHook')]() {}
      }

      sequelize.addModels([MyModel]);

      expect(MyModel.hasHooks(hookName as keyof ModelHooks)).to.eq(true, `hook ${hookName} incorrectly registered its hook`);
    });

    it('throws on non-static hooks', () => {
      expect(() => {
        class MyModel extends Model {
          @decorator
          nonStaticMethod() {}
        }

        sequelize.addModels([MyModel]);

        return MyModel;
      }).to.throw(Error, /This decorator can only be used on static properties/);
    });

    it('throws on non-method properties', () => {
      expect(() => {
        class MyModel extends Model {
          @decorator
          static nonMethod = 'abc';
        }

        sequelize.addModels([MyModel]);

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
      }).to.throw(Error, /This decorator can only be used on models/);
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
