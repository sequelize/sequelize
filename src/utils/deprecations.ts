import { deprecate } from 'node:util';

const noop = () => { /* noop */ };

export const noTrueLogging = deprecate(noop, 'The logging-option should be either a function or false. Default: console.log', 'SEQUELIZE0002');
export const noStringOperators = deprecate(noop, 'String based operators are deprecated. Please use Symbol based operators for better security, read more at https://sequelize.org/docs/v7/core-concepts/model-querying-basics/#deprecated-operator-aliases', 'SEQUELIZE0003');
export const noBoolOperatorAliases = deprecate(noop, 'A boolean value was passed to options.operatorsAliases. This is a no-op with v5 and should be removed.', 'SEQUELIZE0004');
export const noDoubleNestedGroup = deprecate(noop, 'Passing a double nested nested array to `group` is unsupported and will be removed in v6.', 'SEQUELIZE0005');
export const unsupportedEngine = deprecate(noop, 'This database engine version is not supported, please update your database server. More information https://github.com/sequelize/sequelize/blob/main/ENGINE.md', 'SEQUELIZE0006');
export const useErrorCause = deprecate(noop, 'The "parent" and "original" properties in Sequelize errors have been replaced with the native "cause" property. Use that one instead.', 'SEQUELIZE0007');
export const scopeRenamedToWithScope = deprecate(noop, 'Model.scope has been renamed to Model.withScope, and Model.unscoped has been renamed to Model.withoutScope', 'SEQUELIZE0008');
export const schemaRenamedToWithSchema = deprecate(noop, 'Model.schema has been renamed to Model.withSchema', 'SEQUELIZE0009');
export const noSequelizeDataType = deprecate(noop, `Accessing DataTypes on the Sequelize constructor is deprecated. Use the DataTypes object instead.
e.g, instead of using Sequelize.STRING, use DataTypes.STRING`, 'SEQUELIZE0010');
export const noModelDropSchema = deprecate(noop, 'Do not use Model.dropSchema. Use Sequelize#dropSchema or QueryInterface#dropSchema instead', 'SEQUELIZE0011');
export const movedSequelizeParam = deprecate(noop, 'The "sequelize" instance has been moved from the second parameter bag to the first parameter bag in "beforeAssociate" and "afterAssociate" hooks', 'SEQUELIZE0012');
export const hooksReworked = deprecate(noop, 'Sequelize Hooks methods, such as addHook, runHooks, beforeFind, and afterSync… are deprecated in favor of using the methods available through "sequelize.hooks", "Sequelize.hooks" and "YourModel.hooks".', 'SEQUELIZE0013');
export const doNotUseRealDataType = deprecate(noop, 'Sequelize 7 has normalized its FLOAT & DOUBLE data types, and made REAL redundant. FLOAT is now always an IEEE-754 single precision floating point, and DOUBLE a double-precision one. Use either instead of REAL.', 'SEQUELIZE0014');
export const noSchemaParameter = deprecate(noop, 'The schema parameter in QueryInterface#describeTable has been deprecated, use a TableNameWithSchema object to specify the schema or set the schema globally in the options.', 'SEQUELIZE0015');
export const noSchemaDelimiterParameter = deprecate(noop, 'The schemaDelimiter parameter in QueryInterface#describeTable has been deprecated, use a TableNameWithSchema object to specify the schemaDelimiter.', 'SEQUELIZE0016');
export const columnToAttribute = deprecate(noop, 'The @Column decorator has been renamed to @Attribute.', 'SEQUELIZE0017');
export const fieldToColumn = deprecate(noop, 'The "field" option in attribute definitions has been renamed to "columnName".', 'SEQUELIZE0018');
export const noModelTableName = deprecate(noop, 'Model.tableName has been replaced with the more complete Model.modelDefinition.table, or Model.table', 'SEQUELIZE0019');
export const noNewModel = deprecate(noop, `Do not use "new YourModel()" to instantiate a model. Use "YourModel.build()" instead. The previous option is being removed to resolve a conflict with class properties. See https://github.com/sequelize/sequelize/issues/14300#issuecomment-1355188077 for more information.`, 'SEQUELIZE0020');
