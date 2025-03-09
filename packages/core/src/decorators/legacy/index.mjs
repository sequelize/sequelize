import Pkg from './index.js';

// Model Decorators

export const Table = Pkg.Table;

// Attribute Decorators

export const Column = Pkg.Column;
export const Attribute = Pkg.Attribute;
export const AllowNull = Pkg.AllowNull;
export const AutoIncrement = Pkg.AutoIncrement;
export const ColumnName = Pkg.ColumnName;
export const Comment = Pkg.Comment;
export const Default = Pkg.Default;
export const NotNull = Pkg.NotNull;
export const PrimaryKey = Pkg.PrimaryKey;
export const Unique = Pkg.Unique;
export const Index = Pkg.Index;
export const createIndexDecorator = Pkg.createIndexDecorator;

// Built-in Attribute Decorators

export const CreatedAt = Pkg.CreatedAt;
export const UpdatedAt = Pkg.UpdatedAt;
export const DeletedAt = Pkg.DeletedAt;
export const Version = Pkg.Version;

// Association Decorators

export const BelongsTo = Pkg.BelongsTo;
export const BelongsToMany = Pkg.BelongsToMany;
export const HasMany = Pkg.HasMany;
export const HasOne = Pkg.HasOne;

// Validation Decorators

export const ValidateAttribute = Pkg.ValidateAttribute;
export const ModelValidator = Pkg.ModelValidator;
// Other validation decorators are provided by other packages, such as @sequelize/validator.js

// Model Hook Decorators

export const AfterAssociate = Pkg.AfterAssociate;
export const AfterBulkCreate = Pkg.AfterBulkCreate;
export const AfterBulkDestroy = Pkg.AfterBulkDestroy;
export const AfterBulkRestore = Pkg.AfterBulkRestore;
export const AfterBulkUpdate = Pkg.AfterBulkUpdate;
export const AfterCreate = Pkg.AfterCreate;
export const AfterDestroy = Pkg.AfterDestroy;
export const AfterDestroyMany = Pkg.AfterDestroyMany;
export const AfterFind = Pkg.AfterFind;
export const AfterRestore = Pkg.AfterRestore;
export const AfterSave = Pkg.AfterSave;
export const AfterSync = Pkg.AfterSync;
export const AfterUpdate = Pkg.AfterUpdate;
export const AfterUpsert = Pkg.AfterUpsert;
export const AfterValidate = Pkg.AfterValidate;
export const BeforeAssociate = Pkg.BeforeAssociate;
export const BeforeBulkCreate = Pkg.BeforeBulkCreate;
export const BeforeBulkDestroy = Pkg.BeforeBulkDestroy;
export const BeforeBulkRestore = Pkg.BeforeBulkRestore;
export const BeforeBulkUpdate = Pkg.BeforeBulkUpdate;
export const BeforeCount = Pkg.BeforeCount;
export const BeforeCreate = Pkg.BeforeCreate;
export const BeforeDestroy = Pkg.BeforeDestroy;
export const BeforeDestroyMany = Pkg.BeforeDestroyMany;
export const BeforeFind = Pkg.BeforeFind;
export const BeforeFindAfterExpandIncludeAll = Pkg.BeforeFindAfterExpandIncludeAll;
export const BeforeFindAfterOptions = Pkg.BeforeFindAfterOptions;
export const BeforeRestore = Pkg.BeforeRestore;
export const BeforeSave = Pkg.BeforeSave;
export const BeforeSync = Pkg.BeforeSync;
export const BeforeUpdate = Pkg.BeforeUpdate;
export const BeforeUpsert = Pkg.BeforeUpsert;
export const BeforeValidate = Pkg.BeforeValidate;
export const ValidationFailed = Pkg.ValidationFailed;
export const BeforeDefinitionRefresh = Pkg.BeforeDefinitionRefresh;
export const AfterDefinitionRefresh = Pkg.AfterDefinitionRefresh;
