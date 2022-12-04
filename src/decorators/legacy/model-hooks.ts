import { createHookDecorator } from './model-hooks-utils.js';

export const BeforeBulkCreate = createHookDecorator('beforeBulkCreate');
export const AfterBulkCreate = createHookDecorator('afterBulkCreate');

export const BeforeBulkDestroy = createHookDecorator('beforeBulkDestroy');
export const AfterBulkDestroy = createHookDecorator('afterBulkDestroy');

export const BeforeBulkRestore = createHookDecorator('beforeBulkRestore');
export const AfterBulkRestore = createHookDecorator('afterBulkRestore');

export const BeforeBulkUpdate = createHookDecorator('beforeBulkUpdate');
export const AfterBulkUpdate = createHookDecorator('afterBulkUpdate');

export const BeforeAssociate = createHookDecorator('beforeAssociate');
export const AfterAssociate = createHookDecorator('afterAssociate');

export const BeforeCount = createHookDecorator('beforeCount');

export const BeforeCreate = createHookDecorator('beforeCreate');
export const AfterCreate = createHookDecorator('afterCreate');

export const BeforeDestroy = createHookDecorator('beforeDestroy');
export const AfterDestroy = createHookDecorator('afterDestroy');

export const BeforeFind = createHookDecorator('beforeFind');
export const BeforeFindAfterExpandIncludeAll = createHookDecorator('beforeFindAfterExpandIncludeAll');
export const BeforeFindAfterOptions = createHookDecorator('beforeFindAfterOptions');
export const AfterFind = createHookDecorator('afterFind');

export const BeforeRestore = createHookDecorator('beforeRestore');
export const AfterRestore = createHookDecorator('afterRestore');

export const BeforeSave = createHookDecorator('beforeSave');
export const AfterSave = createHookDecorator('afterSave');

export const BeforeSync = createHookDecorator('beforeSync');
export const AfterSync = createHookDecorator('afterSync');

export const BeforeUpdate = createHookDecorator('beforeUpdate');
export const AfterUpdate = createHookDecorator('afterUpdate');

export const BeforeUpsert = createHookDecorator('beforeUpsert');
export const AfterUpsert = createHookDecorator('afterUpsert');

export const BeforeValidate = createHookDecorator('beforeValidate');
export const AfterValidate = createHookDecorator('afterValidate');
export const ValidationFailed = createHookDecorator('validationFailed');
