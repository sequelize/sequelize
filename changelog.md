# Future
- [ADDED] UPSERT support for MSSQL

# 3.25.0
- [FIXED] Set `timestamps` and `paranoid` options from through model on `belongsToMany` association
- [FIXED] Properly apply paranoid condition when `groupedLimit.on` association is `paranoid`
- [FIXED] `restore` now uses `field` from `deletedAt`
- [ADDED] `option.silent` for increment and decrement [#6793](https://github.com/sequelize/sequelize/pull/6793)

# 3.24.7
- [FIXED] MSSQL bulkInsertQuery when options and attributes are not passed [#6782]

# 3.24.6
- [FIXED] groupedLimit.through.where support

# 3.24.5
- [FIXED] GroupedLimit when foreignKey has a field alias

# 3.24.4
- [FIXED] - ORDER clause was not included in subquery if `order` option value was provided as plain string (not as an array value)
- [FIXED] Issue with belongsTo association and foreign keys [#6400](https://github.com/sequelize/sequelize/issues/6400)
- [FIXED] Check that parent exists before appending attributes [#6472](https://github.com/sequelize/sequelize/issues/6472)
- [FIXED] Default options for insert queries [#6644](https://github.com/sequelize/sequelize/pull/6644)

# 3.24.3
- [ADDED] Backport of grouped limit include support
- [ADDED] Export datatypes [#6578](https://github.com/sequelize/sequelize/pull/6578)

# 3.24.2
- [FIXED] Accept dates as string while using `typeValidation` [#6453](https://github.com/sequelize/sequelize/issues/6453)

# 3.24.1
- [FIXED] Add `parent`, `original` and `sql` properties to `UniqueConstraintError`

# 3.24.0
- [ADDED] `restartIdentity` option for truncate in postgres [#5356](https://github.com/sequelize/sequelize/issues/5356)

# 3.23.5

# 3.23.4
- [FIXED] Fixed an issue where custom-named model fields break when offsetting, ordering, and including hasMany simultaneously. [#5985](https://github.com/sequelize/sequelize/issues/5985)
- [FIXED] Don't remove includes from count queries and unify findAndCount and count queries. [#6123](https://github.com/sequelize/sequelize/issues/6123)
- [FIXED] `Model.count` don't include attributes [#5057](https://github.com/sequelize/sequelize/issues/5057)
- [SECURITY] `GEOMETRY` and `GEOGRAPHY` SQL injection attacks [#6194](https://github.com/sequelize/sequelize/issues/6194)

# 3.23.3
- [FIXED] Pass ResourceLock instead of raw connection in MSSQL disconnect handling

# 3.23.2
- [FIXED] Type validation now works with non-strings due to updated validator@5.0.0 [#5861](https://github.com/sequelize/sequelize/pull/5861)
- [FIXED] Improved offset and limit support for SQL server 2008 [#5616](https://github.com/sequelize/sequelize/pull/5616)
- [FIXED] options object cloned in all Sequelize methods (so not modified within Sequelize)

# 3.23.1
- [FIXED] Postgres DECIMAL precision. (PostgreSQL) [#4893](https://github.com/sequelize/sequelize/issues/4893)
- [FIXED] removeColumn tries to delete non-existant foreign key constraint (mysql) [#5808](https://github.com/sequelize/sequelize/issues/5808)
- [FIXED] Relation constraints not being applied correctly [#5865](https://github.com/sequelize/sequelize/issues/5865)

# 3.23.0
- [FIXED] Invalid query generated when using LIKE + ANY [#5736](https://github.com/sequelize/sequelize/issues/5736)
- [FIXED] Method QueryInterface.bulkDelete no longer working when the model parameter is missing. (PostgreSQL) [#5615](https://github.com/sequelize/sequelize/issues/5615)
- [ADDED] Context and custom options for deep creation
- [FIXED] Dates with millisecond precision are inserted correctly in MySQL [#5855](https://github.com/sequelize/sequelize/pull/5855)

# 3.22.0
- [FIXED] Fix defaultValues getting overwritten on build
- [FIXED] Queue queries against tedious connections
- [ADDED] Enable type validation for all queries

# 3.21.0
- [FIXED] Confirmed that values modified in validation hooks are preserved [#3534](https://github.com/sequelize/sequelize/issues/3534)
- [FIXED] Support lower case type names in SQLite [#5482](https://github.com/sequelize/sequelize/issues/5482)
- [FIXED] Support calling `setAssociation` twice on `hasOne` [#5315](https://github.com/sequelize/sequelize/issues/5315)
- [INTERNALS] Removed dependency on wellknown in favor of terraformer-wkt-parser
- [ADDED] Benchmarking feature [#2494](https://github.com/sequelize/sequelize/issues/2494)
- [INTERNALS] Add `Utils.mergeDeep` - allows lodash to be updated to latest version

# 3.20.0
- [ADDED] rejectOnEmpty mode [#272](https://github.com/sequelize/sequelize/issues/272) [#5480](https://github.com/sequelize/sequelize/issues/5480)
- [ADDED] `beforeCount` hook [#5209](https://github.com/sequelize/sequelize/pull/5209)
- [ADDED] `validationFailed` hook [#1626](https://github.com/sequelize/sequelize/issues/1626)
- [ADDED] Support for IEEE floating point literals in postgres and sqlite [#5194](https://github.com/sequelize/sequelize/issues/5194)
- [FIXED] `addColumn` with reference in mysql [#5592](https://github.com/sequelize/sequelize/issues/5592)
- [FIXED] `findAndCountAll` generates invalid SQL, subQuery moves to LEFT OUTER JOIN [#5445](https://github.com/sequelize/sequelize/issues/5445)
- [FIXED] `count` methods pollute the options.includes [#4191](https://github.com/sequelize/sequelize/issues/4191)
- [FIXED] Invalid SQL generated when using group option along with attributes [#3009](https://github.com/sequelize/sequelize/issues/3009)
- [FIXED] Mark index as `unique: true` when `type: 'UNIQUE'`. Fixes [#5351](https://github.com/sequelize/sequelize/issues/5351)
- [FIXED] Improper escaping of bound arrays of strings on Postgres, SQLite, and Microsoft SQL Server

# 3.19.3
- [FIXED] `updatedAt` and `createdAt` values are now set before validation [#5367](https://github.com/sequelize/sequelize/pull/5367)
- [FIXED] `describeTable` maintains proper enum casing in mysql [#5321](https://github.com/sequelize/sequelize/pull/5321)
- [FIXED] Parsing of dates in MySQL, when a named timezone is used [#4208](https://github.com/sequelize/sequelize/issues/4208)
- [FIXED] Truncating in Postgres, when table has a schema [#4306](https://github.com/sequelize/sequelize/issues/4306)
- [FIXED] Moved initialization of scopes later in the model init process. Fixes attribute exclusion in scopes, [#4735](https://github.com/sequelize/sequelize/issues/4735) and [#4925](https://github.com/sequelize/sequelize/issues/4925)
- [FIXED] Multiple custom unique validation messages being overwritten by the first-defined message, [#4920](https://github.com/sequelize/sequelize/issues/4920)

# 3.19.0
- [ADDED] Geography support for postgres
- [FIXED] Migrations failed to add foreign key [#966](https://github.com/sequelize/sequelize/issues/966)
- [FIXED] Prevent race condition after transaction finished [#5222](https://github.com/sequelize/sequelize/issues/5222)
- [FIXED] Fixed Instance.reload issues ([#4844](https://github.com/sequelize/sequelize/issues/4844) and [#4452](https://github.com/sequelize/sequelize/issues/4452))
- [FIXED] Fix upsert when primary key contains `.field` (internal API change for `queryInterface.upsert`) [#4755](https://github.com/sequelize/sequelize/issues/4755)
- [FIXED] Default value for `defaultScope` is now an empty object. This fixes calling `.scope('defaultScope')` when no scope is explicitly defined, see [#5277](https://github.com/sequelize/sequelize/issues/5277)

# 3.18.0
- [ADDED] Support silent: true in bulk update [#5200](https://github.com/sequelize/sequelize/issues/5200)
- [ADDED] `retry` object now part of global settings and can be overridden per call.  The default is 5 retries with a backoff function.  `retry` object can be passed to options with max: 0 to turn off this behavior.
- [ADDED] Sqlite now retries database queries that return SQL_BUSY as the status.
- [ADDED] Add `IF EXIST` to postgres alter enum [#4464](https://github.com/sequelize/sequelize/pull/4464)
- [FIXED] Postgres destroy with `where` fails on JSONB data [#5092](https://github.com/sequelize/sequelize/issues/5092)
- [FIXED] hasMany.separate with foreign keys having `field`

# 3.17.3
- [FIXED] Regression with array values from security fix in 3.17.2

# 3.17.2
- [SECURITY] Force non-buffer blob values to string, https://github.com/nodejs/node/issues/4660

# 3.17.1
- [FIXED] Reverted benchmarking feature since it does not compile on Node v4.0

# 3.17.0
- [SECURITY] Fixed injection vulnerability for order/limit
- [FIXED] MySQL throws error when null GEOMETRY data results in empty buffer [#4953](https://github.com/sequelize/sequelize/issues/4953)

# 3.16.0
- [ADDED] PostgreSQL tsrange (Range of timestamp without time zone) data type support.
- [ADDED] hasOne scope support [#5113](https://github.com/sequelize/sequelize/pull/5113)
- [FIXED] attributes from multiple scopes does not merge  [#4856](https://github.com/sequelize/sequelize/issues/4856)
- [FIXED] Support Unicode strings in mssql [#3752](https://github.com/sequelize/sequelize/issues/3752)
- [FIXED] Do not inject include twice in `options.include` [#5106](https://github.com/sequelize/sequelize/pull/5106)
- [FIXED] Expand and validate include in `aggregate`

# 3.15.1
- [FIXED] calling Model.update() modifies passed values  [#4520](https://github.com/sequelize/sequelize/issues/4520)
- [FIXED] Instance can be chained on .set() and other methods [#4702](https://github.com/sequelize/sequelize/issues/4702)
- [FIXED] includes nested from a `separate` include now work properly [#5080](https://github.com/sequelize/sequelize/pull/5080)

# 3.15.0
- [ADDED] Improve support for pg range type to handle unbound ranges, +/-infinity bounds and empty ranges
- [FIXED] Postgres issue when using named timezone  [#4307](https://github.com/sequelize/sequelize/issues/4307)
- [FIXED] Add support for Babel/ES6 imports [#4881](https://github.com/sequelize/sequelize/issues/4881)

# 3.14.2
- [FIXED] Model.aggregate methods now support attributes and where conditions with fields. [#4935](https://github.com/sequelize/sequelize/issues/4935)
- [FIXED] Don't overwrite options.foreignKey in associations [#4927](https://github.com/sequelize/sequelize/pull/4927)
- [FIXED] Support nested `$col` keys. [#4849](https://github.com/sequelize/sequelize/issues/4849)

# 3.14.1
- [FIXED] Issue with transaction options leaking and certain queries running outside of the transaction connection.

# 3.14.0
- [FIXED] Apply scopes to `aggregate` [#4764](https://github.com/sequelize/sequelize/issues/4764)
- [FIXED] Improved postgres enum schema handling [#4796](https://github.com/sequelize/sequelize/issues/4796)
- [ADDED/FIXED] Lower case `onDelete` option to allow the use of `onDelete: 'CASCADE', hooks: true`.
- [FIXED] Ignore attributes in `count` [#4566](https://github.com/sequelize/sequelize/issues/4566)

# 3.13.0
- [FIXED] timestamp columns are no longer undefined for associations loaded with `separate`. [#4740](https://github.com/sequelize/sequelize/issues/4740)
- [FIXED] Mark unscoped model as `.scoped`, to prevent injection of default scope on includes [#4663](https://github.com/sequelize/sequelize/issues/4663)
- [ADDED] `.previous` now returns and object of previous values when called without `key`. This brings the API in line with `.changed`

# 3.12.1
- [FIXED] Mark postgres connection as invalid if the connection is reset [#4661](https://github.com/sequelize/sequelize/pull/4661)
- [FIXED] Remove usage of "limit" in cases where it's unnecessary, which fixes some of the cases mentioned in [#4404] (https://github.com/sequelize/sequelize/issues/4404)
- [SECURITY] Security concern with `$model.field$`, refactored to now require `$col: 'model.field'`

# 3.12.0
- [ADDED] Preliminary support for `include.on`.
- [FIXED] Partial rollback of datatype validations by hiding it behind the `typeValidation` flag.
- [FIXED] Don't try to select the primary key for models without primary key [#4607](https://github.com/sequelize/sequelize/issues/4607)
- [FIXED] Apply `attributes` when including a scoped model. [#4625](https://github.com/sequelize/sequelize/issues/4625)
- [FIXED] Use bits instead of strings for mssql booleans. [#4621](https://github.com/sequelize/sequelize/pull/4621)
- [FIXED] BulkCreate validation fails for properties with `field` [#3787](https://github.com/sequelize/sequelize/issues/3787)

# 3.11.0
- [INTERNALS] Updated dependencies [#4594](https://github.com/sequelize/sequelize/pull/4594)
    + bluebird@2.10.1
    + dottie@1.0.0
    + wellknown@0.4.0
- [INTERNALS] Updated devDependencies [#4594](https://github.com/sequelize/sequelize/pull/4594)
    + mysql@2.9.0
    - coffee-script
- [FIXED] Add limit to `findOne` when using queries like `{ id: { $gt ...` [#4416](https://github.com/sequelize/sequelize/issues/4416)
- [FIXED] Include all with scopes [#4584](https://github.com/sequelize/sequelize/issues/4584)
- [INTERNALS] Corrected spelling seperate -> separate
- [ADDED] Added `include` and `exclude` to `options.attributes`. [#4074](https://github.com/sequelize/sequelize/issues/4074)
- [FIXED/INTERNALS] Only recurse on plain objects in `mapOptionFieldNames`. [#4596](https://github.com/sequelize/sequelize/issues/4596)

# 3.10.0
- [ADDED] support `search_path` for postgres with lots of schemas [#4534](https://github.com/sequelize/sequelize/pull/4534)
- [ADDED] Expose Association constructor as `Sequelize.Association`
- [ADDED] beforeSync/afterSync/beforeBulkSync/afterBulksync hooks [#4479](https://github.com/sequelize/sequelize/issues/4479)
- [FIXED] Calling set with dot.separated key on a JSON/JSONB attribute will not flag the entire object as changed [#4379](https://github.com/sequelize/sequelize/pull/4379)
- [FIXED] instances returned from `bulkCreate` now has `isNewRecord: false` and should be updateable if using `returning: true` with dialects that support it.
- [FIXED] Find with Include with a where clause generates wrong SQL [#3940](https://github.com/sequelize/sequelize/issues/3940)
- [FIXED] ON DELETE constraint should default to CASCADE if foreignKey has allowNull: false] [#2831](https://github.com/sequelize/sequelize/issues/2831)
- [FIXED] sqlite file handle leak

# 3.9.0
- [ADDED] beforeRestore/afterRestore hooks [#4371](https://github.com/sequelize/sequelize/issues/4371)
- [ADDED] Map raw fields back to attributes names when using `mapToModel` or `returning` [#3995](https://github.com/sequelize/sequelize/pull/3995)
- [ADDED] `skip` now supports filtering out modewl validators [#4528](https://github.com/sequelize/sequelize/pull/4528)
- [INTERNALS] `options` has been renamed to `$options` in instance.js [#4429](https://github.com/sequelize/sequelize/pull/4429)
- [FIXED] Reload doesn't synchronize a null include [#4353](https://github.com/sequelize/sequelize/issues/4353)
- [FIXED] commit/rollback multiple times on same transaction [#4491](https://github.com/sequelize/sequelize/issues/4491)
- [FIXED] memory leak / options mangle for scopes with include [#4470](https://github.com/sequelize/sequelize/issues/4470)
- [FIXED] custom `targetKey` for belongsTo on a target with a primary key will now correctly create foreign key constraints [#4455](https://github.com/sequelize/sequelize/issues/4455)

# 3.8.0
- [ADDED] `version` on `Sequelize` returning the current npm/package.json version [#4459](https://github.com/sequelize/sequelize/pull/4459)

# 3.7.0
- [ADDED] Define field dependencies for VIRTUAL types that are automatically pulled into `attributes` [#4420](https://github.com/sequelize/sequelize/pull/4420)
- [FIXED] Fall back to a default version when parsing the DB version fails [#4368](https://github.com/sequelize/sequelize/issues/4368)
- [FIXED] Fix a bug where passing null as the second parameter to `sequelize.where` would fail [#4334](https://github.com/sequelize/sequelize/issues/4334)
- [FIXED] An error is thrown if a column called `id` is added, but not marked as primary key, and no other pk is present. [#4139](https://github.com/sequelize/sequelize/issues/4139)
- [FIXED] Cast to boolean when querying JSON [#4257](https://github.com/sequelize/sequelize/issues/4257)

# 3.6.0
- [ADDED] Model.findCreateFind: A more performant findOrCreate that will not work under a transaction (atleast not in postgres)
- [FIXED] Show indexes query on Postgres fails to return functional indexes [#3911](https://github.com/sequelize/sequelize/issues/3911)
- [FIXED] Custom field names in json queries
- [FIXED] JSON cast key using the equality operator. [#3824](https://github.com/sequelize/sequelize/issues/3824)
- [FIXED] Map column names with `.field` in scopes with includes. [#4210](https://github.com/sequelize/sequelize/issues/4210)
- [FIXED] `addScope` when the model does not have any initial scopes [#4243](https://github.com/sequelize/sequelize/issues/4243)
- [FIXED] Fixed destroy with limit in PG when the primary key is aliassed [#4027](https://github.com/sequelize/sequelize/pull/4027)
- [FIXED] Clone the options object in `increment`, `decrement`, `destroy`, `reload`, `restore`, and `save`. [#4023](https://github.com/sequelize/sequelize/pull/4023)
- [FIXED] Throw a `Sequelize.Error` when `authenticate` fails [#4209](https://github.com/sequelize/sequelize/pull/4209)
- [FIXED] BTM would remove any previously added association getters [#4268](https://github.com/sequelize/sequelize/pull/4268)
- [FIXED] Pass through connection mode options to sqlite
[#4288](https://github.com/sequelize/sequelize/issues/4288)
- [INTERNALS] Updated dependencies [#4332](https://github.com/sequelize/sequelize/pull/4332)
    + toposort-class@1.0.1
    + validator@4.0.4
    + wkx@0.1.0
- [INTERNALS] Updated devDependencies [#4336](https://github.com/sequelize/sequelize/pull/4336)
    + chai-spies@0.7.0
    + dox@0.8.0
    + mysql@2.8.0

# 3.5.1
- [FIXED] Fix bug with nested includes where a middle include results in a null value which breaks $findSeparate.

# 3.5.0
- [ADDED] `include.separate` with `include.limit` support for HasMany associations.
- [ADDED] Added default validation based on attribute types. [#3472](https://github.com/sequelize/sequelize/pull/3472). The validation _cannot_ be disabled. If you really want to completely disable it, you can remove the `validate` function from the corresponding datatype, but know that this permanently disables the validation.
- [ADDED] `describeTable`  now marks the primary key (Reroll of [#3703](https://github.com/sequelize/sequelize/pull/3703))
- [ADDED] Automatically determine the version of the database upon first connection [#4192](https://github.com/sequelize/sequelize/pull/4192). This will be useful going forward in order to provide support for older database versions.
- [ADDED] `addScope` [#3963](https://github.com/sequelize/sequelize/issues/3963)
- [FIXED] Fix findOrCreate regression trying to add a transaction even if there is none
- [FIXED] Fix save to be noop when nothing changed
- [FIXED] Call `conformOptions` on default scope [#4157](https://github.com/sequelize/sequelize/issues/4157)
- [FIXED] Call `conformOptions` on scopes returned by functions [#3991](https://github.com/sequelize/sequelize/issues/3991)
- [FIXED] Calling `validateIncludedElements` should not add an aliassed primary key multiple times [#4127](https://github.com/sequelize/sequelize/issues/4127)
- [FIXED] Handle scoped model in includes properly [#3700](https://github.com/sequelize/sequelize/issues/3700)
- [FIXED] Enum naming with schemas [#3171](https://github.com/sequelize/sequelize/issues/3171) and [#3563](https://github.com/sequelize/sequelize/issues/3563)
- [FIXED] Prevent polution of the lodash object by using `runInContext` [#2281](https://github.com/sequelize/sequelize/issues/2281)

# 3.4.1
- [FIXED] Fix belongs-to-many `countAssociations` - ambigious id when through model has id

# 3.4.0
- [ADDED] `countAssociations` for hasMany and belongsToMany
- [ADDED] Geometry support for postgres
- [FIXED] Fix wrong count for `findAndCountAll` with required includes [#4016](https://github.com/sequelize/sequelize/pull/4016)
- [FIXED] Fix problems related to parsing of unique constraint errors [#4017](https://github.com/sequelize/sequelize/issues/4017) and [#4012](https://github.com/sequelize/sequelize/issues/4012)
- [FIXED] Fix postgres path variable being surrounded by quotes to often in unique constraint errors [#4034](https://github.com/sequelize/sequelize/pull/4034)
- [FIXED] Fix `removeAttributes(id)` not setting `this.primaryKeys` to null
- [FIXED] Run validations on the through model during add, set and create for `belongsToMany`

# 3.3.2
- [FIXED] upsert no longer updates with default values each time [#3994](https://github.com/sequelize/sequelize/pull/3994)

# 3.3.1
- [FIXED] regression in `attributes` support for 'reload' [#3976](https://github.com/sequelize/sequelize/issues/3976)

# 3.3.0
- [FIXED] Fix `Promise#nodeify()` and `Promise#done()` not passing CLS context
- [FIXED] Creating and dropping enums in transaction, only for PostgreSQL [#3782](https://github.com/sequelize/sequelize/issues/3782)
- [FIXED] $or/$and inside a where clause always expects the input to be an array [#3767](https://github.com/sequelize/sequelize/issues/3767)
- [ADDED] Unique constraints may now include custom error messages
- [ADDED] It's possible now to remove a hook by name
- [ADDED] Hook name can be passed via the direct method [#3901](https://github.com/sequelize/sequelize/issues/3901)

# 3.2.0
- [ADDED] Add support for new option `targetKey` in a belongs-to relationship for situations where the target key is not the id field.
- [ADDED] Add support for keyword `after` in options of a field (useful for migrations), only for MySQL. [#3166](https://github.com/sequelize/sequelize/pull/3166)
- [ADDED] There's a new sequelize.truncate function to truncate all tables defined through the sequelize models [#2671](https://github.com/sequelize/sequelize/pull/2671)
- [ADDED] Add support for MySQLs TINYTEXT, MEDIUMTEXT and LONGTEXT. [#3836](https://github.com/sequelize/sequelize/pull/3836)
- [ADDED] Provide warnings if you misuse data types. [#3839](https://github.com/sequelize/sequelize/pull/3839)
- [FIXED] Fix a case where Postgres arrays containing JSONB type was being generated as JSON type.
- [FIXED] Fix a case where `type` in `sequelize.query` was not being set to raw. [#3800](https://github.com/sequelize/sequelize/pull/3800)
- [FIXED] Fix an issue where include all was not being properly expanded for self-references [#3804](https://github.com/sequelize/sequelize/issues/3804)
- [FIXED] Fix instance.changed regression to not return false negatives for not changed null values [#3812](https://github.com/sequelize/sequelize/issues/3812)
- [FIXED] Fix isEmail validator to allow args: true [#3770](https://github.com/sequelize/sequelize/issues/3770)
- [FIXED] Fix all occasions where `options.logging` was not used correctly [#3834](https://github.com/sequelize/sequelize/issues/3834)
- [FIXED] Fix `Model#destroy()` to correctly use `options.transaction`
- [FIXED] Fix `QueryInterface#showIndex()` to correctly pass on `options.transaction`

# 3.1.1
- [FIXED] Always quote aliases, even when quoteIdentifiers is false [#1589](https://github.com/sequelize/sequelize/issues/1589)
- [FIXED] No longer clones Instances in model finder options
- [FIXED] Fix regression in util.toDefaultValue not returning the data types [#3733](https://github.com/sequelize/sequelize/pull/3733)

# 3.1.0

- [ADDED] It is now possible to defer constraints in PostgreSQL by added a property `deferrable` to the `references` object of a field.
- [FIXED] Fix an issue with the build in isIP validator returning false negatives [#3756](https://github.com/sequelize/sequelize/pull/3756)

# 3.0.1

- [FIXED] `include.attributes = []` will no longer force the inclusion of the primary key, making it possible to write aggregates with includes.
- [CHANGED] The `references` property of model attributes has been transformed to an object: `{type: Sequelize.INTEGER, references: { model: SomeModel, key: 'some_key' }}`. The former format (`references` and `referecesKey`) still exists but is deprecated and will be removed in 4.0.

# 3.0.0

3.0.0 cleans up a lot of deprecated code, making it easier for us to develop and maintain features in the future.

- [ADDED] findById / findByPrimary takes a single value as argument representing the primary key to find.
- [CHANGED] belongsToMany relations MUST now be given a `through` argument.
- [CHANGED] findOne / findAll / findAndCount / findOrCreate now only takes a single options argument instead of a options and queryOptions argument. So set transaction, raw, etc on the first options argument.
- [CHANGED] The accessor for belongsToMany relationships is now either the `as` argument or the target model name pluralized.
- [REMOVED] N:M relationships can no longer be represented by 2 x hasMany
- [REMOVED] Model.create / Model.bulkCreate / Instance.save no longer takes an array of fields as its second argument, use `options.fields` instead.
- [REMOVED] Query Chainer has been removed
- [REMOVED] Migrations have been removed, use umzug instead
- [REMOVED] Model.findAllJoin has been removed
- [REMOVED] sequelize.query now only takes `sql and options` as arguments, the second and fourth argument `callee` and `replacements` have been removed and should be set via `options.instance` / `options.model` and  `options.replacements` instead.
- [REMOVED] `instance.isDirty` has been removed, use `instance.changed()` instead
- [REMOVED] `instance.values` has been removed, use `instance.get()` instead
- [REMOVED] `instance.primaryKeyValues` has been removed.
- [REMOVED] `instance.identifiers` has been removed, use `instance.where()` instead
- [REMOVED] `instance.isDeleted` has been removed, simply check the timestamp with `get('deletedAt')` instead
- [REMOVED] `instance.increment/decrement` now longer takes a number as it's second argument.
- [REMOVED/SECURITY] findOne no longer takes a string / integer / binary argument to represent a primaryKey. Use findById instead
- [REMOVED/SECURITY] `where: "raw query"` is no longer legal, you must now explicitely use `where: ["raw query", [replacements]]`
- [FIXED] Fix showIndexQuery so appropriate indexes are returned when a schema is used
- [FIXED] Fix addIndexQuery error when the model has a schema
- [FIXED] Fix app crash in sqlite while running in special unique constraint errors [#3730](https://github.com/sequelize/sequelize/pull/3730)
- [FIXED] Fix bulkCreate: do not insert NULL for undefined values [#3729](https://github.com/sequelize/sequelize/pull/3729)
- [FIXED] Fix trying to roll back a comitted transaction if an error occured while comitting resulting in an unhandled rejection [#3726](https://github.com/sequelize/sequelize/pull/3726)
- [FIXED] Fix regression in beforeUpdate hook where `instance.changed()` would always be false [#3727](https://github.com/sequelize/sequelize/pull/3727)
- [FIXED] Fix trying to roll back a comitted transaction if an error occured while comitting

#### Backwards compatibility changes
- Most of the changes in 3.0.0 are BC breaking, read the changelog for 3.0.0 carefully.
- The error that is thrown when a column is declared to be an enum but without any values used to "Values for ENUM haven't been defined" and is now "Values for ENUM have not been defined".

# 2.1.3
- [BUG] Fix regression introduced in 2.1.2: updatedAt not set anymore [#3667](https://github.com/sequelize/sequelize/pull/3667)
- [BUG] Fix managed transactions not rolling back if no thenable was provided in the transaction block [#3667](https://github.com/sequelize/sequelize/pull/3667)

# 2.1.2
- [BUG] `Model.create()/update()` no longer attempts to save undefined fields.

# 2.1.1
- [BUG] .get() now passes along options correctly when using a custom getter
- [BUG] Fix managed transactions not rolling back if an error occured the transaction block [#3661](https://github.com/sequelize/sequelize/pull/3661)
- [BUG] Fix a node-webkit issue [#3650](https://github.com/sequelize/sequelize/pull/3650)
- [FEATURE] Lock modes in Postgres now support `OF table`
- [FEATURE] New transaction lock modes `FOR KEY SHARE` and `NO KEY UPDATE` for Postgres 9.3+
- [FEATURE/REFACTOR] Rewritten scopes with complete support for includes and scopes across associations

# 2.1.0
- [BUG] Enable standards conforming strings on connection in postgres. Adresses [#3545](https://github.com/sequelize/sequelize/issues/3545)
- [BUG] instance.removeAssociation(s) do not fire the select query twice anymore
- [BUG] Error messages thrown by the db in languages other than english do not crash the app anymore (mysql, mariadb and postgres only) [#3567](https://github.com/sequelize/sequelize/pull/3567)
- [FEATURE] [JSONB](https://github.com/sequelize/sequelize/issues/3471)
- [FEATURE] All querys can be logged individually by inserting `logging: fn` in the query option.
- [FEATURE] Partial index support for Postgres with `index.where`
- [REFACTOR] `.changed()` now works proactively by setting a flag on `set` instead of matching reactively. Note that objects and arrays will not be checked for equality on set and will always result in a change if they are `set`.
- [DEPRECATED] The query-chainer is deprecated and will be removed in version 2.2. Please use promises instead.
- [REMOVED] Events are no longer supported.
- [INTERNALS] Updated dependencies.
    + bluebird@2.9.24

#### Backwards compatibility changes
- Events support have been removed so using `.on('success')` or `.success()` is no longer supported. Try using `.then()` instead.
- Trying to apply a scope that does not exist will always throw an error

# 2.0.6
- [BUG] Don't update virtual attributes in Model.update. Fixes [#2860](https://github.com/sequelize/sequelize/issues/2860)
- [BUG] Fix for newlines in hstore [#3383](https://github.com/sequelize/sequelize/issues/3383)
- [BUG] Fix unique key handling in Model.update [#3474](https://github.com/sequelize/sequelize/issues/3474)
- [BUG] Fix issue with Model.create() using fields not specifying and non-incremental primary key [#3458](https://github.com/sequelize/sequelize/issues/3458)
- [FEATURE] `field` support for Model.update [#3498](https://github.com/sequelize/sequelize/pull/3498)
- [INTERNALS] Updated dependencies. Most notably we are moving up one major version on lodash. If you are using `sequelize.Utils._`, notice that the semantics for many matching functions have changed to include a check for `hasOwnProperty`
    + dottie@0.3.1
    + inflection@1.6.0
    + lodash@3.5.0
    + validator@3.34
    + generic-pool@2.2.0
- [INTERNALS] Updated devDependencies.
    + coffee-script@1.9.1
    + dox@0.7.1
    + mysql@2.6.2

# 2.0.5
- [FEATURE] Highly experimental support for nested creation [#3386](https://github.com/sequelize/sequelize/pull/3386)

# 2.0.4
- [BUG] Fixed support for 2 x belongsToMany without foreignKey defined and association getter/adder [#3185](https://github.com/sequelize/sequelize/issues/3185)
- [BUG] No longer throws on `Model.hasHook()` if no hooks are defiend [#3181](https://github.com/sequelize/sequelize/issues/3181)
- [BUG] Fixed issue with `{$and: []}`
- [BUG] Fixed issue with N:M relations with primary keys with field defined

# 2.0.3
- [BUG] Support for plain strings, ints and bools on JSON insert
- [BUG] Fixed regression where `{$in: []}` would result in `IN ()` rather than `IN (NULL)` [#3105](https://github.com/sequelize/sequelize/issues/3105) [#3132](https://github.com/sequelize/sequelize/issues/3132)
- [BUG] Fixed bug where 2 x `belongsToMany` with `foreignKey` but no `otherKey` defined would result in 3 keys instead of 2. [#2991](https://github.com/sequelize/sequelize/issues/2991)
- [BUG] Fixed regression with `where: sequelize.json()` [#3138](https://github.com/sequelize/sequelize/issues/3138)
- [BUG] Fixed support for `field` with `$or`/`$and` [#3153](https://github.com/sequelize/sequelize/issues/3153)

# 2.0.2
- [BUG] Fixed regression with `DataTypes.ARRAY(DataTypes.STRING(length))` [#3106](https://github.com/sequelize/sequelize/issues/3106)
- [BUG] Fixed regression where `.or([{key: value}, {key: value, key2: value}])` would result in 3 `A OR B OR C` rather than `A OR (B AND C)` [#3107](https://github.com/sequelize/sequelize/issues/3107)
- [BUG] Fixed regression with `DataTypes.DECIMAL(10)` resulting in `10, undefined` [#3119](https://github.com/sequelize/sequelize/issues/3119)
- [BUG] Fixed issue with dangling `WHERE ` query on `Model.update(values, {where: {}})` [#3113](https://github.com/sequelize/sequelize/issues/3113)

# 2.0.1
- [BUG] Fixed issue with empty `include.where`
- [BUG] Fixed issue with otherKey generation for self-association N:M

# 2.0.0
- [BUG] Fixed `field` support for `increment` and `decrement`.
- [FEATURE/BUG] Raw queries always return all results (including affected rows etc). This means you should change all promise listeners on `sequelize.query` to use `.spread` instead of `.then`, unless you are passing a query type.
- [BUG] Support for composite primary keys in upsert [#3065](https://github.com/sequelize/sequelize/pull/3065)
- [BUG] Support for `field` in upsert
- [FEATURE] Support for setting an initial autoincrement option in mysql [#3076](https://github.com/sequelize/sequelize/pull/3076)
- [FEATURE] Test coverage for Node.js 0.12 and io.js 1.x

#### Backwards compatibility changes
- The default query type for `sequelize.query` is now `RAW` - this means that two arguments (results and metadata) will be returned by default and you should use `.spread`
- The 4th argument to `sequelize.query` has been deprecated in favor of `options.replacements`

# 2.0.0-rc8
- [FEATURE] CLS Support. CLS is also used to automatically pass the transaction to any calls within the callback chain when using `sequelize.transaction(function() ...`.
- [BUG] Fixed issue with paranoid deletes and `deletedAt` with a custom field.
- [BUG] No longer crahes on `where: []`
- [FEATURE] Validations are now enabled by default for upsert.
- [FEATURE] Preliminary support for `include.through.where`
- [SECURITY/BUG] Fixed injection issue in direction param for order

# 2.0.0-rc7
- [FEATURE] Throw an error if no where clause is given to `Model.destroy()`.
- [BUG] Fixed issue with `order: sequelize.literal('string')`
- [FEATURE] add `clone: true` support to `.get()`. Is needed when using `delete` on values from a `.get()` (`toJSON()`, `this.values`). (.get() is just a reference to the values for performance reasons when there's no custom getters or includes)
- [FEATURE] add `sequelize.escape(value)` convenience method
- [BUG] Fixes crash with `findAll({include: [Model], order: sequelize.literal()})`
- [FEATURE] Now possible to pass `createdAt` and `updatedAt` values to `Model.create`/`Model.bulkCreate` when using silent: true (when importing datasets with existing timestamps)
- [FEATURE] `instance.update()` using default fields will now automatically also save and validate values provided via `beforeUpdate` hooks
- [BUG] Fixed bad SQL when updating a JSON attribute with a different `field`
- [BUG] Fixed issue with creating and updating values of a `DataTypes.ARRAY(DataTypes.JSON)` attribute
- [BUG] `Model.bulkCreate([{}], {returning: true})` will now correctly result in instances with primary key values.
- [BUG] `instance.save()` with `fields: []` (as a result of `.changed()` being `[]`) will no result in a noop instead of an empty update query.
- [BUG] Fixed case where `findOrCreate` could return `[null, true]` when given a `defaults` value that triggered a unique constraint error.

#### Backwards compatibility changes
- `instance.update()` using default fields will now automatically also save and validate values provided via `beforeUpdate` hooks
- Sequelize no longer supports case insensitive mysql enums
- `pg-hstore` has been moved to a devDependency, Postgres users will have to install `pg-hstore` manually alongside `pg`: `$ npm install pg pg-hstore`

# 2.0.0-rc6
- [BUG] Fixed issue with including by association reference and where

# 2.0.0-rc5
- [BUG] Fixed issue with subquery creating `include.where` and a paranoid main model.#2749/#2769
- UniqueConstraintErrors will now extend from ValidationError making it possible to catch both with `.catch(ValidationError)`
- [FEATURE] Adds `{save: false}` for belongsTo relationship setters. `user.setOrganization(organization, {save: false})` will then only set the foreign key value, but not trigger a save on `user`.
- [FEATURE] When updating an instance `_previousDataValues` will now be updated after `afterUpdate` hooks have been run rather than before allowing you to use `changed` in `afterUpdate`
- [BUG] Sequelize will no longer fail on a postgres constraint error not defined by Sequelize
- [FEATURE] It's now possible to pass an association reference to include. `var Owner = Company.belongsTo(User, {as: 'owner'}; Company.findOne({include: [Owner]});`

#### Backwards compatibility changes
- When updating an instance `_previousDataValues` will now be updated after `afterUpdate` hooks have been run rather than before allowing you to use `changed` in `afterUpdate`

# 2.0.0-rc4
- [INTERNALS] Update `inflection` dependency to v1.5.3
- [FEATURE] Replaced string error messages for connection errors with error objects. [#2576](https://github.com/sequelize/sequelize/pull/2576)
- [FEATURE] Support for updating fields on duplicate key in bulk update (mysql only) [#2692](https://github.com/sequelize/sequelize/pull/2692)
- [FEATURE] Basic support for Microsoft SQL Server
- [INTERNALS] Deprecate migration logic. This is now implemented in [umzug](https://github.com/sequelize/umzug) and the [CLI](https://github.com/sequelize/cli).
- [BUG] Fixed various inconsistencies with `Instance.update` and how it behaves together with `create`, `fields` and more.
- [BUG] Fixed crash/bug when using `include.where` together with `association.scope`
- [BUG] Fixed support for `Instance.destroy()` and `field` for postgres.

#### Backwards compatibility changes
- Some of the string error messages for connection errors have been replaced with actual error instances. Checking for connection errors should now be more consistent.

# 2.0.0-rc3
- [FEATURE] Added the possibility of removing multiple associations in 1 call [#2338](https://github.com/sequelize/sequelize/issues/2338)
- [FEATURE] Undestroy method for paranoid models [#2540](https://github.com/sequelize/sequelize/pull/2540)
- [FEATURE] Support for UPSERT
- [BUG] Add support for `field` named the same as the attribute in `reload`, `bulkCreate` and `save` [#2348](https://github.com/sequelize/sequelize/issues/2348)
- [BUG] Copy the options object in association getters. [#2311](https://github.com/sequelize/sequelize/issues/2311)
- [BUG] `Model#destroy()` now supports `field`, this also fixes an issue with `N:M#removeAssociation` and `field`
- [BUG] Customized error message can now be set for unique constraint that was created manually (not with sync, but e.g. with migrations) or that has fields with underscore naming. This was problem at least with postgres before.
- [BUG] Fixed a bug where plain objects like `{ in: [...] }` were not properly converted to SQL when combined with a sequelize method (`fn`, `where` etc.). Closes [#2077](https://github.com/sequelize/sequelize/issues/2077)
- [BUG] Made the default for array search in postgres exact comparison instead of overlap
- [BUG] Allow logging from individual functions even though the global logging setting is false. Closes [#2571](https://github.com/sequelize/sequelize/issues/2571)
- [BUG] Allow increment/decrement operations when using schemata
- [BUG] Allow createTable with schema
- [BUG] Fix some issues with findAndCount and include
- [INTERNALS] Update `inflection` dependency to v1.5.2
- [REMOVED] Remove query generation syntactic sugar provided by `node-sql`, as well as the dependency on that module

#### Backwards compatibility changes
- When eager-loading a many-to-many association, the attributes of the through table are now accessible through an attribute named after the through model rather than the through table name singularized. i.e. `Task.find({include: Worker})` where the table name for through model `TaskWorker` is `TableTaskWorkers` used to produce `{ Worker: { ..., TableTaskWorker: {...} } }`. It now produces `{ Worker: { ..., TaskWorker: {...} } }`. Does not affect models where table name is auto-defined by Sequelize, or where table name is model name pluralized.
- When using `Model#find()` with an `order` clause, the table name is prepended to the `ORDER BY` SQL. e.g. `ORDER BY Task.id` rather than `ORDER BY id`. The change is to avoid ambiguous column names where there are eager-loaded associations with the same column names. A side effect is that code like `Task.findAll( { include: [ User ], order: [ [ 'Users.id', 'ASC' ] ] } )` will now throw an error. This should be achieved with `Task.findAll( { include: [ User ], order: [ [ User, 'id', 'ASC' ] ] } )` instead.
- Nested HSTORE objects are no longer supported. Use DataTypes.JSON instead.
- In PG `where: { arr: [1, 2] }` where the `arr` column is an array will now use strict comparison (`=`) instead of the overlap operator (`&&`). To obtain the old behaviour, use `  where: { arr: { overlap: [1, 2] }}`
- The default `fields` for `Instance#save` (when not a new record) is now an intersection of the model attributes and the changed attributes making saves more atomic while still allowing only defined attributes.
- Syntactic sugar for query generation was removed. You will no longer be able to call Model.dataset() to generate raw sql queries

# 2.0.0-rc2
- [FEATURE] Added to posibility of using a sequelize object as key in `sequelize.where`. Also added the option of specifying a comparator
- [FEATURE] Added countercache functionality to hasMany associations [#2375](https://github.com/sequelize/sequelize/pull/2375)
- [FEATURE] Basic JSON support [#2314](https://github.com/sequelize/sequelize/pull/2314)
- [BUG] Fixes regression bug with multiple hasMany between the same models with different join tables. Closes [#2316](https://github.com/sequelize/sequelize/issues/2316)
- [BUG] Don't set autocommit in nested transactions [#2418](https://github.com/sequelize/sequelize/issues/2418)
- [BUG] Improved `field` support

# 2.0.0-rc1
- [BUG] Fixed an issue with foreign key object syntax for hasOne and belongsTo
- [FEATURE] Added `field` and `name` to the object form of foreign key definitions
- [FEATURE] Added support for calling `Promise.done`, thus explicitly ending the promise chain by calling done with no arguments. Done with a function argument still continues the promise chain, to maintain BC.
- [FEATURE] Added `scope` to hasMany association definitions, provides default values to association setters/finders [#2268](https://github.com/sequelize/sequelize/pull/2268)
- [FEATURE] We now support transactions that automatically commit/rollback based on the result of the promise chain returned to the callback.
- [BUG] Only try to create indexes which don't already exist. Closes [#2162](https://github.com/sequelize/sequelize/issues/2162)
- [FEATURE] Hooks are passed options
- [FEATURE] Hooks need not return a result - undefined return is interpreted as a resolved promise
- [FEATURE] Added `find()` hooks

#### Backwards compatibility changes
- The `fieldName` property, used in associations with a foreign key object `(A.hasMany(B, { foreignKey: { ... }})`, has been renamed to `name` to avoid confusion with `field`.
- The naming of the join table entry for N:M association getters is now singular (like includes)
- Signature of hooks has changed to pass options to all hooks. Any hooks previously defined like `Model.beforeCreate(values)` now need to be `Model.beforeCreate(values, options)` etc.
- Results returned by hooks are ignored - changes to results by hooks should be made by reference
- `Model.destroy()` signature has been changed from `(where, options)` to `(options)`, options now take a where parameter.
- `Model.update()` signature has been changed from `(values, where, options)` to `(values, options)`, options now take a where parameter.
- The syntax for `Model.findOrBuild` has changed, to be more in line with the rest of the library. `Model.findOrBuild(where, defaults);` becomes `Model.findOrBuild({ where: where, defaults: defaults });`.

# v2.0.0-dev13
We are working our way to the first 2.0.0 release candidate.

- [FEATURE] Added to option of setting a timezone offset in the sequelize constructor (`timezone` option). This timezone is used when initializing a connection (using `SET TIME ZONE` or equivalent), and when converting a timestamp string from the DB to a JS date with mysql (postgres stores the timezone, so for postgres we rely on what's in the DB).
- [FEATURE] Allow setting plural and singular name on the model (`options.name` in `sequelize.define`) and in associations (`options.as`) to circumvent issues with weird pluralization.
- [FEATURE] Added support for passing an `indexes` array in options to `sequelize.define`. [#1485](https://github.com/sequelize/sequelize/issues/1485). See API reference for details.
- [FEATURE/INTERNALS] Standardized the output from `QueryInterface.showIndex`.
- [FEATURE] Include deleted rows in find [#2083](https://github.com/sequelize/sequelize/pull/2083)
- [FEATURE] Make addSingular and addPlural for n:m associations (fx `addUser` and `addUsers` now both accept an array or an instance.
- [BUG] Hid `dottie.transform` on raw queries behind a flag (`nest`) [#2064](https://github.com/sequelize/sequelize/pull/2064)
- [BUG] Fixed problems with transaction parameter being removed / not passed on in associations [#1789](https://github.com/sequelize/sequelize/issues/1789) and [#1968](https://github.com/sequelize/sequelize/issues/1968)
- [BUG] Fix problem with minConnections. [#2048](https://github.com/sequelize/sequelize/issues/2048)
- [BUG] Fix default scope being overwritten [#2087](https://github.com/sequelize/sequelize/issues/2087)
- [BUG] Fixed updatedAt timestamp not being set in bulk create when validate = true. [#1962](https://github.com/sequelize/sequelize/issues/1962)
- [INTERNALS] Replaced lingo with inflection
- [INTERNALS] Removed underscore.string dependency and moved a couple of helper functions from `Utils._` to `Utils`
- [INTERNALS] Update dependencies
    + validator 3.2.0 -> 3.16.1
    + moment 2.5.0 -> 2.7.0
    + generic-pool 2.0.4 -> 2.1.1
    + sql 0.35.0 -> 0.39.0
- [INTERNALS] Use a transaction inside `findOrCreate`, and handle unique constraint errors if multiple calls are issues concurrently on the same transaction

#### Backwards compatibility changes
- We are using a new inflection library, which should make pluralization and singularization in general more robust. However, a couple of pluralizations have changed as a result:
    + Person is now pluralized as people instead of persons
- Accesors for models with underscored names are no longer camel cased automatically. For example, if you have a model with name `my_model`, and `my_other_model.hasMany(my_model)`, the getter will now be `instance_of_my_model.getMy_model` instead of `.getMyModel`.
- Removed support for setting sequelize.language. If your model names are not in english, use the name option provided by `sequelize.name` to defined singular and plural forms for your model.
- Model names are now used more verbatim in associations. This means that if you have a model named `Task` (plural T), or an association specifying `{ as: 'Task' }`, the tasks will be returned as `relatedModel.Tasks` instead of `relatedModel.tasks`. For more information and how to mitigate this, see https://github.com/sequelize/sequelize/wiki/Upgrading-to-2.0#inflection-replaces-lingo-and-changes-to-naming-conventions
- Removed the freezeAssociations option - use model and assocation names instead to provide the plural form yourself
- Removed sequelize.language option (not supported by inflection)
- Error handling has been refactored. Code that listens for :
    + All Error classes properly inherit from Error and a common SequelizeBaseError base
    + Instance Validator returns a single instance of a ValidationError which contains an errors array property. This property contains individual error items for each failed validation.
    + ValidationError includes a `get(path)` method to find all broken validations for a path on an instance. To migrate existing error handling, switch from array indexing to using the get method:

        Old: `err.validateCustom[0]`
        New: `err.get('validateCustom')[0]`
- The syntax for findOrCreate has changed, to be more in line with the rest of the library. `Model.findOrCreate(where, defaults);` becomes `Model.findOrCreate({ where: where, defaults: defaults });`.


# v2.0.0-dev12
- [FEATURE] You can now return a promise to a hook rather than use a callback
- [FEATURE] There is now basic support for assigning a field name to an attribute `name: {type: DataTypes.STRING, field: 'full_name'}`
- [FEATURE] It's now possible to add multiple relations to a hasMany association, modelInstance.addRelations([otherInstanceA, otherInstanceB])
- [FEATURE] `define()` stores models in `sequelize.models` Object e.g. `sequelize.models.MyModel`
- [FEATURE] The `set` / `add` / `has` methods for associations now allow you to pass the value of a primary key, instead of a full Instance object, like so: `user.addTask(15);`.
- [FEATURE] Support for FOR UPDATE and FOR SHARE statements [#1777](https://github.com/sequelize/sequelize/pull/1777)
- [FEATURE] n:m createAssocation now returns the target model instance instead of the join model instance
- [FEATURE] Extend the `foreignKey` option for associations to support a full data type definition, and not just a string
- [FEATURE] Extract CLI into [separate projects](https://github.com/sequelize/cli).
- [FEATURE] Sqlite now inserts dates with millisecond precision
- [FEATURE] Sequelize.VIRTUAL datatype which provides regular attribute functionality (set, get, etc) but never persists to database.
- [BUG] An error is now thrown if an association would create a naming conflict between the association and the foreign key when doing eager loading. Closes [#1272](https://github.com/sequelize/sequelize/issues/1272)
- [BUG] Fix logging options for sequelize.sync
- [BUG] find no longer applies limit: 1 if querying on a primary key, should fix a lot of subquery issues.
- [BUG] Transactions now use the pool so you will never go over your pool defined connection limit
- [BUG] Fix use of Sequelize.literal in eager loading and when renaming attributes [#1916](https://github.com/sequelize/sequelize/pull/1916)
- [BUG] Use the provided name for a unique index if one is given, instead of concating the column names together [#1944](https://github.com/sequelize/sequelize/issues/1944)
- [BUG] Create a composite primary key for doubled linked self reference [#1891](https://github.com/sequelize/sequelize/issues/1891)
- [INTERNALS] `bulkDeleteQuery` was removed from the MySQL / abstract query generator, since it was never used internally. Please use `deleteQuery` instead.

#### Backwards compatibility changes
- Sequelize now returns promises instead of its custom event emitter from most calls. This affects methods that return multiple values (like `findOrCreate` or `findOrInitialize`). If your current callbacks do not accept the 2nd success parameter you might be seeing an array as the first param. Either use `.spread()` for these methods or add another argument to your callback: `.success(instance)` -> `.success(instance, created)`.
- `.success()`/`.done()` and any other non promise methods are now deprecated (we will keep the codebase around for a few versions though). on('sql') persists for debugging purposes.
- Model association calls (belongsTo/hasOne/hasMany) are no longer chainable. (this is to support being able to pass association references to include rather than model/as combinations)
- `QueryInterface` no longer emits global events. This means you can no longer do things like `QueryInterface.on('showAllSchemas', function ... `
- `sequelize.showAllSchemas` now returns an array of schemas, instead of an array containinig an array of schemas
- `sequelize.transaction()` now returns a promise rather than a instance of Sequelize.Transaction
- `bulkCreate`, `bulkUpdate` and `bulkDestroy` (and aliases) now take both a `hooks` and an `individualHooks` option, `hooks` defines whether or not to run the main hooks, and `individualHooks` defines whether to run hooks for each instance affected.
- It is no longer possible to disable pooling, disable pooling will just result in a 1/1 pool.

# v2.0.0-dev11
### Caution: This release contains many changes and is highly experimental
- [PERFORMANCE] increased build performance when using include, which speeds up findAll etc.
- [BUG] Made it possible to use HSTORE both in attribute: HSTORE and attribute: { type: HSTORE } form. Thanks to @tomchentw [#1458](https://github.com/sequelize/sequelize/pull/1458)
- [FEATURE] n:m now marks the columns of the through table as foreign keys and cascades them on delete and update by default.
- [FEATURE] 1:1 and 1:m marks columns as foreign keys, and sets them to cascade on update and set null on delete. If you are working with an existing DB which does not allow null values, be sure to override those options, or disable them completely by passing constraints: false to your assocation call (`M1.belongsTo(M2, { constraints: false})`).
- [BUG] Removed the hard dependency on pg, allowing users to use pg.js
- [BUG] Fixed a bug with foreign keys pointing to attributes that were not integers. Now your primaryKey can be a string, and associations will still work. Thanks to @fixe [#1544](https://github.com/sequelize/sequelize/pull/1544)
- [BUG] Fix a case where createdAt timestamp would not be set when updatedAt was disabled  Thanks to @fixe [#1543](https://github.com/sequelize/sequelize/pull/1543)
- [BUG] Fix a case where timestamps were not being write protected in `set` when underscored=true. janmeier [#1523](https://github.com/sequelize/sequelize/pull/1523)
- [FEATURE/BUG] Prefetching/includes now fully support schemas
- [FEATURE] Centralize logging. [#1566](https://github.com/sequelize/sequelize/pull/1566)
- [FEATURE/BUG] hstore values are now parsed on find/findAll. Thanks to @nunofgs [#1560](https://github.com/sequelize/sequelize/pull/1560)
- [FEATURE] Read cli options from a file. Thanks to @codeinvain  [#1540](https://github.com/sequelize/sequelize/pull/1540)

#### Backwards compatibility changes
- The `notNull` validator has been removed, use the Schema's `allowNull` property.
- All Validation errors now return a sequelize.ValidationError which inherits from Error.
- selectedValues has been removed for performance reasons, if you depend on this, please open an issue and we will help you work around it.
- foreign keys will now correctly be based on the alias of the model
  - if you have any 1:1 relations where both sides use an alias, you'll need to set the foreign key, or they'll each use a different foreign key based on their alias.
- foreign keys for non-id primary keys will now be named for the foreign key, i.e. pub_name rather than pub_id
  - if you have non-id primary keys you should go through your associations and set the foreignKey option if relying on a incorrect _id foreign key
- syncOnAssocation has been removed. It only worked for n:m, and having a synchronous function (hasMany) that invokes an asynchronous function (sync) without returning an emitter does not make a lot of sense. If you (implicitly) depended on this feature, sequelize.sync is your friend. If you do not want to do a full sync, use custom through models for n:m (`M1.hasMany(M2, { through: M3})`) and sync the through model explicitly.
- Join tables will be no longer be paranoid (have a deletedAt timestamp added), even though other models are.
- All tables in select queries will now be aliased with the model names to be support schemas. This will affect people stuff like `where: {'table.attribute': value}

# v1.7.10
- [FEATURE] ilike support for postgres [#2122](https://github.com/sequelize/sequelize/pull/2122)
- [FEATURE] distinct option for count [#2079](https://github.com/sequelize/sequelize/pull/2079)
- [BUG] various fixes

# v1.7.9
- [BUG] fixes issue with custom primary keys and N:M join tables [#1929](https://github.com/sequelize/sequelize/pull/1923)

# v1.7.8
- [FEATURE] adds rlike support for mysql

# v1.7.7
- [BUG] fixes issue where count/findAndCountAll would throw on empty rows [#1849](https://github.com/sequelize/sequelize/pull/1849)

# v1.7.6
- [BUG] fixes issue where primary key is also foreign key [#1818](https://github.com/sequelize/sequelize/pull/1818)

# v1.7.5
- [BUG] fixes bug with some methods relying on table information throwing strange errors [#1686](https://github.com/sequelize/sequelize/pull/1686)

# v1.7.3
- [BUG] fixes foreign key types for hasMany

# v1.7.2
- [BUG] fixes transactions support for 1-to-1 association setters.

# v1.7.1
- [BUG] fixes issue where relations would not use transactions probably in adders/setters.

# v1.7.0
- [FEATURE] covers more advanced include cases with limiting and filtering (specifically cases where a include would be in the subquery but its child include wouldnt be, for cases where a 1:1 association had a 1:M association as a nested include)
- [BUG] fixes issue where connection would timeout before calling COMMIT resulting in data never reaching the database [#1429](https://github.com/sequelize/sequelize/pull/1429)

# v1.7.0-rc9
- [PERFORMANCE] fixes performance regression introduced in rc7
- [FEATURE] include all relations for a model [#1421](https://github.com/sequelize/sequelize/pull/1421)
- [BUG] N:M adder/getter with through model and custom primary keys now work

# v1.7.0-rc8
- [BUG] fixes bug with required includes without wheres with subqueries

# v1.7.0-rc7
- [BUG] ORDER BY statements when using includes should now be places in the appropriate sub/main query more intelligently.
- [BUG] using include.attributes with primary key attributes specified should no longer result in multiple primary key attributes being selected [#1410](https://github.com/sequelize/sequelize/pull/1410)
- [DEPENDENCIES] all dependencies, including Validator have been updated to the latest versions.

#### Backwards compatability changes
- .set() will no longer set values that are not a dynamic setter or defined in the model. This only breaks BC since .set() was introduced but restores original .updateAttributes functionality where it was possible to 'trust' user input.

# v1.7.0-rc6
- [BUG] Encode binary strings as bytea in postgres, and fix a case where using a binary as key in an association would produce an error [1364](https://github.com/sequelize/sequelize/pull/1364). Thanks to @SohumB

# v1.7.0-rc5
- [FEATURE] sync() now correctly returns with an error when foreign key constraints reference unknown tables
- [BUG] sync() no longer fails with foreign key constraints references own table (toposort self-dependency error)
- [FEATURE] makes it possible to specify exactly what timestamp attributes you want to utilize [#1334](https://github.com/sequelize/sequelize/pull/1334)
- [FEATURE] Support coffee script files in migrations. [#1357](https://github.com/sequelize/sequelize/pull/1357)
- [FEATURE] include.where now supports Sequelize.and()/.or(). [#1361](https://github.com/sequelize/sequelize/pull/1361)

# v1.7.0-rc4
- [BUG] fixes issue with postgres sync and enums [#1020](https://github.com/sequelize/sequelize/issues/1020)
- [BUG] fixes various issues with limit and includes [#1322](https://github.com/sequelize/sequelize/pull/1322)
- [BUG] fixes issues with migrations/queryInterface createTable and enums
- [BUG] migration/queryInterface.addIndex() no longer fails on reserved keywords like 'from'
- [FEATURE] bulkCreate now supports a `ignoreDuplicates` option for MySQL, SQLite and MariaDB that will use `INSERT IGNORE`
- [BUG] fixes regression bug with 1:M self associations
- [FEATURE] significant performance improvements for 1:1 and single primary key includes for 500+ rows [#1333](https://github.com/sequelize/sequelize/pull/1333)

#### Backwards compatability changes
- find/findAll will now always return primary keys regardless of `attributes` settings. (Motivation was to fix various issues with eager loading)

# v1.7.0-rc3
- [FEATURE] dropAllTables now takes an option parameter with `skip` as an option [#1280](https://github.com/sequelize/sequelize/pull/1280)
- [FEATURE] implements .spread for eventemitters [#1277](https://github.com/sequelize/sequelize/pull/1277)
- [BUG] fixes some of the mysql connection error bugs [#1282](https://github.com/sequelize/sequelize/pull/1282)
- [Feature] Support for OR queries.
- [Feature] Support for HAVING queries. [#1286](https://github.com/sequelize/sequelize/pull/1286)
- [FEATURE] bulkUpdate and bulkDestroy now returns affected rows. [#1293](https://github.com/sequelize/sequelize/pull/1293)
- [BUG] fixes transaction memory leak issue
- [BUG] fixes security issue where it was possible to overwrite the id attribute when defined by sequelize (screwup - and fix - by mickhansen)

# v1.7.0-rc2
- [BUG] fixes unixSocket connections for mariadb [#1248](https://github.com/sequelize/sequelize/pull/1248)
- [BUG] fixes a hangup issue for mysql [#1244](https://github.com/sequelize/sequelize/pull/1244)
- [BUG] improves handling of uncaught errors in eventemitter [#1245](https://github.com/sequelize/sequelize/pull/1245)
- [BUG] fixes bug with mysql replication and pool settings [#1251](https://github.com/sequelize/sequelize/pull/1251)
- [BUG] fixes bug where through models created by N:M associations would inherit hooks [#1263](https://github.com/sequelize/sequelize/issues/1263)
- [FEATURE] .col()/.literal()/etc now works with findAll [#1249](https://github.com/sequelize/sequelize/issues/1249)
- [BUG] now currectly handles connection timeouts as errors [#1207](https://github.com/sequelize/sequelize/issues/1207)

# v2.0.0 (alpha1) #
- [FEATURE] async validations. [#580](https://github.com/sequelize/sequelize/pull/580). thanks to Interlock

# v1.7.0-rc1
- [FEATURE] instance.createAssociationInstance functionality added [#1213](https://github.com/sequelize/sequelize/pull/1213)
- [BUG] fixes a few bugs with transactions in regards to associations
- [FEATURE] add error handling for transaction creation
- [FEATURE] `sequelize --undo` will now actually undo migrations. Its basically an alias for `sequelize --migrate --undo`. [#1059](https://github.com/sequelize/sequelize/pull/1059)
- [BUG] fix bug where `{where: {ne: null}}` would result in `!= NULL` instead of `IS NOT NULL` [#1231](https://github.com/sequelize/sequelize/pull/1059)
- [BUG] fixes a bug with validation skipping using the `fields` options. [#1233](https://github.com/sequelize/sequelize/pull/1233)
- [BUG] fixes a bug with postgres and setters [#1234](https://github.com/sequelize/sequelize/issues/1234)
- [BUG] fixes it so `field: {type: Sequelize.ENUM(value1, value2)}` works

#### Backwards compatability changes
- Hooks are no longer passing value hashes. Instead, they are now passing instances of the model.
- Hook callbacks no longer take two arguments (previously: `err, newValues`). They only take the error argument since values can be changed directly on the model instance.

# v1.7.0-beta8
- [FEATURE] max()/min() now supports dates [#1200](https://github.com/sequelize/sequelize/pull/1200)
- [FEATURE] findAndCountAll now supports the include option

#### Backwards compatibility changes
- You will now need to include the relevant subtables to query on them in finders (find/findAll)
- Subquery logic no longer depends on where objects with keys containing '.', instead where options on the include options [#1199](https://github.com/sequelize/sequelize/pull/1199)

# v1.7.0-beta7 #
- [FEATURE] Nested eager loading / prefetching is now supported. [Docs](http://sequelizejs.com/docs/latest/models#nested-eager-loading)
- [FEATURE] Eager loading / prefetching now supports inner joins and extending the ON statement [#1199](https://github.com/sequelize/sequelize/pull/1199)
- [FEATURE] Eager loading / prefetching now returns the attributes of through models aswell [#1198](https://github.com/sequelize/sequelize/pull/1198)
- [FEATURE] New set/get/changed/previous feature [#1182](https://github.com/sequelize/sequelize/pull/1182)
- Various bug fixes

#### Backwards compatibility changes
None

# v1.7.0-beta1 #
- [DEPENDENCIES] Upgraded validator for IPv6 support. [#603](https://github.com/sequelize/sequelize/pull/603). thanks to durango
- [DEPENDENCIES] replaced underscore by lodash. [#954](https://github.com/sequelize/sequelize/pull/594). thanks to durango
- [DEPENDENCIES] Upgraded pg to 2.0.0. [#711](https://github.com/sequelize/sequelize/pull/711). thanks to durango
- [DEPENDENCIES] Upgraded command to 2.0.0 and generic-pool to 2.0.4. thanks to durango
- [DEPENDENCIES] No longer require semver. thanks to durango
- [BUG] Fix string escape with postgresql on raw SQL queries. [#586](https://github.com/sequelize/sequelize/pull/586). thanks to zanamixx
- [BUG] "order by" is now after "group by". [#585](https://github.com/sequelize/sequelize/pull/585). thanks to mekanics
- [BUG] Added decimal support for min/max. [#583](https://github.com/sequelize/sequelize/pull/583). thanks to durango
- [BUG] Null dates don't break SQLite anymore. [#572](https://github.com/sequelize/sequelize/pull/572). thanks to mweibel
- [BUG] Correctly handle booleans in MySQL. [#608](https://github.com/sequelize/sequelize/pull/608). Thanks to terraflubb
- [BUG] Fixed empty where conditions in MySQL. [#619](https://github.com/sequelize/sequelize/pull/619). Thanks to terraflubb
- [BUG] Allow overriding of default columns. [#635](https://github.com/sequelize/sequelize/pull/635). Thanks to sevastos
- [BUG] Fix where params for belongsTo [#658](https://github.com/sequelize/sequelize/pull/658). Thanks to mweibel
- [BUG] Default ports are now declared in the connector manager, which means the default port for PG correctly becomes 5432. [#633](https://github.com/sequelize/sequelize/issues/633). durango
- [BUG] Columns with type BOOLEAN were always added to toJSON output, even if they were not selected [see](https://gist.github.com/gchaincl/45aca14e93934bf4a05e). janmeier
- [BUG] Hstore is now fully supported [#695](https://github.com/sequelize/sequelize/pull/695). thanks to tadman
- [BUG] Correct join table name for tables with custom names [#698](https://github.com/sequelize/sequelize/pull/698). thanks to jjclark1982
- [BUG] PostgreSQL should now be able to insert empty arrays with typecasting. [#718](https://github.com/sequelize/sequelize/pull/718). thanks to durango
- [BUG] Fields should be escaped by quoteIdentifier for max/min functions which allows SQL reserved keywords to be used. [#719](https://github.com/sequelize/sequelize/pull/719). thanks to durango
- [BUG] Fixed bug when trying to save objects with eagerly loaded attributes [#716](https://github.com/sequelize/sequelize/pull/716). thanks to iamjochen
- [BUG] Strings for .find() should be fixed. Also added support for string primary keys to be found easily. [#737](https://github.com/sequelize/sequelize/pull/737). thanks to durango
- [BUG] bulkCreate would have problems with a disparate field list [#738](https://github.com/sequelize/sequelize/pull/738). thanks to durango
- [BUG] Fixed problems with quoteIdentifiers and {raw: false} option on raw queries [#751](https://github.com/sequelize/sequelize/pull/751). thanks to janmeier
- [BUG] Fixed SQL escaping with sqlite and unified escaping [#700](https://github.com/sequelize/sequelize/pull/700). thanks to PiPeep
- [BUG] Fixed Postgres' pools [ff57af63](https://github.com/sequelize/sequelize/commit/ff57af63c2eb395b4828a5984a22984acdc2a5e1)
- [BUG] Fixed BLOB/TEXT columns having a default value declared in MySQL [#793](https://github.com/sequelize/sequelize/pull/793). thanks to durango
- [BUG] You can now use .find() on any single integer primary key when throwing just a number as an argument [#796](https://github.com/sequelize/sequelize/pull/796). thanks to durango
- [BUG] Adding unique to a column for Postgres in the migrator should be fixed [#795](https://github.com/sequelize/sequelize/pull/795). thanks to durango
- [BUG] For MySQL users, if their collation allows case insensitivity then allow enums to be case insensitive as well [#794](https://github.com/sequelize/sequelize/pull/794). thanks to durango
- [BUG] Custom primary key (not keys, just singular) should no longer be a problem for models when using any of the data retrievals with just a number or through associations [#771](https://github.com/sequelize/sequelize/pull/771). thanks to sdephold & durango
- [BUG] Default schemas should now be utilized when describing tables [#812](https://github.com/sequelize/sequelize/pull/812). thanks to durango
- [BUG] Fixed eager loading for many-to-many associations. [#834](https://github.com/sequelize/sequelize/pull/834). thanks to lemon-tree
- [BUG] allowNull: true enums can now be null [#857](https://github.com/sequelize/sequelize/pull/857). thanks to durango
- [BUG] Fixes Postgres' ability to search within arrays. [#879](https://github.com/sequelize/sequelize/pull/879). thanks to durango
- [BUG] Find and finAll would modify the options objects, now the objects are cloned at the start of the method [#884](https://github.com/sequelize/sequelize/pull/884) thanks to janmeier. Improved in [#899](https://github.com/sequelize/sequelize/pull/899) thanks to hackwaly
- [BUG] Add support for typed arrays in SqlString.escape and SqlString.arrayToList [#891](https://github.com/sequelize/sequelize/pull/891). thanks to LJ1102
- [BUG] Postgres requires empty array to be explicitly cast on update [#890](https://github.com/sequelize/sequelize/pull/890). thanks to robraux
- [BUG] Added tests & bugfixes for DAO-Factory.update and array of values in where clause [#880](https://github.com/sequelize/sequelize/pull/880). thanks to domasx2
- [BUG] sqlite no longer leaks a global `db` variable [#900](https://github.com/sequelize/sequelize/pull/900). thanks to xming
- [BUG] Fix for counts queries with no result [#906](https://github.com/sequelize/sequelize/pull/906). thanks to iamjochem
- [BUG] Allow include when the same table is referenced multiple times using hasMany [#913](https://github.com/sequelize/sequelize/pull/913). thanks to janmeier
- [BUG] Allow definition of defaultValue for the timestamp columns (createdAt, updatedAt, deletedAt) [#930](https://github.com/sequelize/sequelize/pull/930). Thank to durango
- [BUG] Don't delete foreign keys of many-to-many associations, if still needed. [#961](https://github.com/sequelize/sequelize/pull/961). thanks to sdepold
- [BUG] Update timestamps when incrementing and decrementing [#1023](https://github.com/sequelize/sequelize/pull/1023). durango
- [FEATURE] Validate a model before it gets saved. [#601](https://github.com/sequelize/sequelize/pull/601). thanks to durango
- [FEATURE] Schematics. [#564](https://github.com/sequelize/sequelize/pull/564). thanks to durango
- [FEATURE] Foreign key constraints. [#595](https://github.com/sequelize/sequelize/pull/595). thanks to optilude
- [FEATURE] Support for bulk insert (`<DAOFactory>.bulkCreate()`, update (`<DAOFactory>.update()`) and delete (`<DAOFactory>.destroy()`) [#569](https://github.com/sequelize/sequelize/pull/569). thanks to optilude
- [FEATURE] Add an extra `queryOptions` parameter to `DAOFactory.find` and `DAOFactory.findAll`. This allows a user to specify `{ raw: true }`, meaning that the raw result should be returned, instead of built DAOs. Usefull for queries returning large datasets, see [#611](https://github.com/sequelize/sequelize/pull/611) janmeier
- [FEATURE] Added convenient data types. [#616](https://github.com/sequelize/sequelize/pull/616). Thanks to Costent
- [FEATURE] Binary is more verbose now. [#612](https://github.com/sequelize/sequelize/pull/612). Thanks to terraflubb
- [FEATURE] Promises/A support. [#626](https://github.com/sequelize/sequelize/pull/626). Thanks to kevinbeaty
- [FEATURE] Added Getters/Setters method for DAO. [#538](https://github.com/sequelize/sequelize/pull/538). Thanks to iamjochem
- [FEATURE] Added model wide validations. [#640](https://github.com/sequelize/sequelize/pull/640). Thanks to tremby
- [FEATURE] `findOrCreate` now returns an additional flag (`created`), that is true if a model was created, and false if it was found [#648](https://github.com/sequelize/sequelize/pull/648). janmeier
- [FEATURE] Field and table comments for MySQL and PG. [#523](https://github.com/sequelize/sequelize/pull/523). MySQL by iamjochen. PG by janmeier
- [FEATURE] BigInts can now be used for autoincrement/serial columns. [#673](https://github.com/sequelize/sequelize/pull/673). thanks to sevastos
- [FEATURE] Use moment for better postgres timestamp strings. [#710](https://github.com/sequelize/sequelize/pull/710). Thanks to seth-admittedly
- [FEATURE] Keep milliseconds in timestamps for postgres. [#712](https://github.com/sequelize/sequelize/pull/712). Thanks to seth-admittedly
- [FEATURE] You can now set lingo's language through Sequelize. [#713](https://github.com/sequelize/sequelize/pull/713). Thanks to durango
- [FEATURE] Added a `findAndCountAll`, useful for pagination. [#533](https://github.com/sequelize/sequelize/pull/533). Thanks to iamjochen
- [FEATURE] Made explicit migrations possible. [#728](https://github.com/sequelize/sequelize/pull/728). Thanks to freezy
- [FEATURE] Added support for where clauses containing !=, < etc. and support for date ranges  [#727](https://github.com/sequelize/sequelize/pull/727). Thanks to durango
- [FEATURE] Added support for model instances being referenced [#761](https://github.com/sequelize/sequelize/pull/761) thanks to sdepold
- [FEATURE] Added support for specifying the path to load a module for a dialect. [#766](https://github.com/sequelize/sequelize/pull/766) thanks to sonnym.
- [FEATURE] Drop index if exists has been added to sqlite [#766](https://github.com/sequelize/sequelize/pull/776) thanks to coderbuzz
- [FEATURE] bulkCreate() now has a third argument which gives you the ability to validate each row before attempting to bulkInsert [#797](https://github.com/sequelize/sequelize/pull/797). thanks to durango
- [FEATURE] Added `isDirty` to model instances. [#798](https://github.com/sequelize/sequelize/pull/798). Thanks to mstorgaard
- [FEATURE] Added possibility to use env variable for the database connection. [#784](https://github.com/sequelize/sequelize/pull/784). Thanks to sykopomp.
- [FEATURE] Blob support. janmeier
- [FEATURE] We can now define our own custom timestamp columns [#856](https://github.com/sequelize/sequelize/pull/856). thanks to durango
- [FEATURE] Scopes. [#748](https://github.com/sequelize/sequelize/pull/748). durango
- [FEATURE] Model#find() / Model#findAll() is now working with strings. [#855](https://github.com/sequelize/sequelize/pull/855). Thanks to whito.
- [FEATURE] Shortcut method for getting a defined model. [#868](https://github.com/sequelize/sequelize/pull/868). Thanks to jwilm.
- [FEATURE] Added Sequelize.fn() and Sequelize.col() to properly call columns and functions within Sequelize. [#882](https://github.com/sequelize/sequelize/pull/882). thanks to janmeier
- [FEATURE] Sequelize.import supports relative paths. [#901](https://github.com/sequelize/sequelize/pull/901). thanks to accerqueira.
- [FEATURE] Sequelize.import can now handle functions. [#911](https://github.com/sequelize/sequelize/pull/911). Thanks to davidrivera.
- [FEATURE] Uses sequelize.fn and sequelize.col functionality to allow you to use the value of another column or a function when updating. It also allows you to use a function as a default value when supported (in sqlite and postgres). [#928](https://github.com/sequelize/sequelize/pull/928). thanks to janmeier
- [FEATURE] Added possibility to pass options to node-mysql. [#929](https://github.com/sequelize/sequelize/pull/929). thanks to poying
- [FEATURE] Triggers for Postgres. [#915](https://github.com/sequelize/sequelize/pull/915). Thanks to jonathana.
- [FEATURE] Support for join tables. [#877](https://github.com/sequelize/sequelize/pull/877). Thanks to janmeier.
- [FEATURE] Support for hooks. [#894](https://github.com/sequelize/sequelize/pull/894). Thanks to durango.
- [FEATURE] Support for literals and casts. [#950](https://github.com/sequelize/sequelize/pull/950). Thanks to durango.
- [FEATURE] Model#findOrBuild. [#960](https://github.com/sequelize/sequelize/pull/960). Thanks to durango.
- [FEATURE] Support for MariaDB. [#948](https://github.com/sequelize/sequelize/pull/948). Thanks to reedog117 and janmeier.
- [FEATURE] Filter through associations. [#991](https://github.com/sequelize/sequelize/pull/991). Thanks to snit-ram.
- [FEATURE] Possibility to disable loging for .sync [#937](https://github.com/sequelize/sequelize/pull/937). Thanks to durango
- [FEATURE] Support for transactions. [1062](https://github.com/sequelize/sequelize/pull/1062).
- [REFACTORING] hasMany now uses a single SQL statement when creating and destroying associations, instead of removing each association seperately [690](https://github.com/sequelize/sequelize/pull/690). Inspired by [#104](https://github.com/sequelize/sequelize/issues/104). janmeier
- [REFACTORING] Consistent handling of offset across dialects. Offset is now always applied, and limit is set to max table size of not limit is given [#725](https://github.com/sequelize/sequelize/pull/725). janmeier
- [REFACTORING] Moved Jasmine to Buster and then Buster to Mocha + Chai. sdepold and durango

# v1.6.0 #
- [DEPENDENCIES] upgrade mysql to alpha7. You *MUST* use this version or newer for DATETIMEs to work
- [DEPENDENCIES] upgraded most dependencies. most important: mysql was upgraded to 2.0.0-alpha-3
- [DEPENDENCIES] mysql is now an optional dependency. #355 (thanks to clkao)
- [REFACTORING] separated tests for dialects
- [REFACTORING] reduced number of sql queries used for adding an element to a N:M association. #449 (thanks to innofluence/janmeier)
- [REFACTORING] dropped support for synchronous migrations. added third parameter which needs to get called once the migration has been finished. also this adds support for asynchronous actions in migrations.
- [OTHERS] code was formatted to fit the latest code style guidelines (thanks to durango)
- [OTHERS] Explicitly target ./docs folder for generate-docs script. #444 (thanks to carsondarling)
- [OTHERS] Overwrite existing daoFactoryDefinition if there already has been one. (thanks to robraux)
- [BUG] fixed wrong version in sequelize binary
- [BUG] local options have higher priority than global options (thanks to guersam)
- [BUG] fixed where clause when passing an empty array (thanks to kbackowski)
- [BUG] fixed updateAttributes for models/tables without primary key (thanks to durango)
- [BUG] fixed the location of the foreign key when using belongsTo (thanks to ricardograca)
- [BUG] don't return timestamps if only specific attributes have been seleceted (thanks to ricardograca)
- [BUG] fixed removeColumn for sqlite
- [BUG] fixed date equality check for instances. (thanks to solotimes)
- [FEATURE] added association prefetching /eager loading for find and findAll. #465
- [FEATURE] it's now possible to use callbacks of async functions inside migrations (thanks to mphilpot)
- [FEATURE] improved comfort of sequelize.query. just pass an sql string to it and wait for the result
- [FEATURE] Migrations now understand NODE_ENV (thanks to gavri)
- [FEATURE] Performance improvements (thanks to Mick-Hansen and janmeier from innofluence)
- [FEATURE] Model.find and Model.findAll can now take a String with an ID. (thanks to ghernandez345)
- [FEATURE] Compatibility for JSON-like strings in Postgres (thanks to aslakhellesoy)
- [FEATURE] honor maxConcurrentQueries option (thanks to dchester)
- [FEATURE] added support for stored procedures (inspired by wuyuntao)
- [FEATURE] added possibility to use pg lib's native api (thanks to denysonique)
- [FEATURE] added possibility to define the attributes of received associations (thanks to joshm)
- [FEATURE] added findOrCreate, which returns a the already existing instance or creates one (thanks to eveiga)
- [FEATURE] minConnections option for MySQL pooling (thanks to dominiklessel)
- [FEATURE] added BIGINT data type which is treated like a string (thanks to adamsch1)
- [FEATURE] experimental support for read replication for mysql (thanks to Janzeh)
- [FEATURE] allow definition of a models table name (thanks to slamkajs)
- [FEATURE] allow usage of enums. #440 (thanks to KevinMartin)
- [FEATURE] allows updateAttributes to target specific fields only (thanks to Pasvaz)
- [FEATURE] timestamps are now stored as UTC. #461 (thanks to innofluence/janmeier)
- [FEATURE] results of raw queries are parsed with dottie. #468 (thanks to kozze89)
- [FEATURE] support for array serialization. pg only. #443 (thanks to clkao)
- [FEATURE] add increment and decrement methods on dao. #408 (thanks to janmeier/innofluence)
- [FEATURE] unified the result of describeTable
- [FEATURE] add support for decimals (thanks to alexyoung)
- [FEATURE] added DAO.reload(), which updates the attributes of the DAO in-place (as opposed to doing having to do a find() and returning a new model)

# v1.5.0 #
- [REFACTORING] use underscore functions for Utils.isHash (thanks to Mick-Hansen/innofluence)
- [REFACTORING] removed the 'failure' event and replaced it with 'error'
- [BUG] fixed booleans for sqlite (thanks to vlmonk)
- [BUG] obsolete reference attribute for many-to-many associations are removed correctly
- [BUG] associations can be cleared via passing null to the set method
- [BUG] "fixed" quota handling (thanks to dgf)
- [BUG] fixed destroy in postgresql (thanks to robraux)
- [FEATURE] added possibility to set protocol and to remove port from postgresql connection uri (thanks to danielschwartz)
- [FEATURE] added possibility to not use a junction table for many-to-many associations on the same table (thanks to janmeier/innofluence)
- [FEATURE] results of the `import` method is now cached (thanks to janmeier/innofluence)
- [FEATURE] added possibility to check if a specific object or a whole bunch of objects is currently associated with another object (thanks to janmeier/innofluence)
- [FEATURE] added possibility to globally disable adding of NULL values to sql queries (thanks to janmeier/innofluence)
- [FEATURE] Model.create can now also be used to specify values for mass assignment (thanks to janmeier/innofluence)
- [FEATURE] QueryChainer will now provide the results of the added emitters in the order the emitters have been added (thanks to LaurentZuijdwijk and me ;))
- [FEATURE] QueryChainer can now be initialized with serial items
- [FEATURE] node 0.8 compatibility
- [FEATURE] added options to hasMany getters (thanks to janmeier/innofluence)
- [FEATURE] pooling option is now correctly passed to postgres (thanks to megshark)

# v1.4.1 #
- [DEPRECATION] Added deprecation warning for node < v0.6.
- [FEATURE] added selective saving of instances (thanks to kioopi)
- [FEATURE] added command to binary for creating a migration skeleton with current timestamp
- [FEATURE] added `complete` function for each finder method (thanks to sstoiana)
- [BUG] fixed quotation for sqlite statements (thanks to vlmonk)
- [BUG] fixed timestamp parsing in migratios (thanks to grn)
- [FEATURE] added consistent logging behaviour to postgres (thanks to reacuna)

# v1.4.0 #
- [BUG] fixed booleans in sqlite (thanks to alexstrat)
- [BUG] fixed forced sync of many-to-many associations (thanks to SirUli)
- [FEATURE] objects are now compatible to JSON.stringify. (thanks to grayt0r)
- [FEATURE] When instantiating the sequelize object, you can now pass a function to logging. This allows you to customize the logging behavior. Default is now: console.log (thanks to kenperkins)
- [BUG] The default logging is still console.log but is wrapped after initialization as it crashes node < 0.6.x.
- [FEATURE] postgresql support. (thanks to swoodtke)
- [FEATURE] connection-pooling for mysql. (thanks to megshark)
- [FEATURE] added possibility to define NOW as default value for date data-types. Use Sequelize.NOW as defaultValue
- [BUG] Fixed date handling in sqlite (thanks to iizukanao)

# v1.3.7 #
- [BUG] fixed issue where multiple belongsTo or hasOne associations to the same table overwrite each other
- [BUG] fixed memory leaks (thanks to megshark)

# v1.3.6 #
- [BUG] don't update an existing updatedAt-attribute if timestamps option for a DAO is false

# v1.3.5 #
- [BUG] fixed missed DAO renaming in migrations (thanks to nov)

# v1.3.4 #
- [REFACTORING] renamed Model/ModelFactory/ModelFactoryManager to DAO/DAOFactory/DAOFactoryManager
- [IMPROVEMENT] `npm test` will run the test suite (thanks to gabrielfalcao)
- [IMPROVEMENT] documentation about setting up local development environment (thanks to gabrielfalcao)
- [REFACTORING] removed updatedAt + createdAt from SequelizeMeta

# v1.3.3 #
- [BUG] fixed sql-event emitter in all possible locations (thanks to megshark)

# v1.3.2 #
- [FEATURE] sqlite is now emitting the 'sql'-event as well (thanks to megshark)

# v1.3.1 #
- [REFACTORING] renamed ModelManager to ModelFactoryManager
- [IMPROVEMENT] decreased delay of CustomEventEmitter execution from 5ms to 1ms
- [IMPROVEMENT] improved performance of association handling (many-to-many) (thanks to magshark)
- [FEATURE] added possibility to specify name of the join table (thanks to magshark)
- [FEATURE] mysql is emitting a 'sql'-event when executing a query
- [BUG] correctly delete existing SequelizeMeta entry from database after undoing migration
- [BUG] fix path of migration files in executable (thanks to bcg)

# v1.3.0 #
- [REFACTORING] Model#all is now a function and not a getter.
- [REFACTORING] Renamed ModelDefinition to ModelFactory
- [REFACTORING] Private method scoping; Attributes are still public
- [REFACTORING] Use the new util module for node 0.6.2
- [FEATURE] QueryChainer can now run serially
- [FEATURE] Association definition is chainable: Person.hasOne(House).hasMany(Address)
- [FEATURE] Validations (Thanks to [hiddentao](https://github.com/hiddentao))
- [FEATURE] jQuery-like event listeners: .success(callback) and .error(callback)
- [FEATURE] aliasing for select queries: Model.find({ where: 'id = 1', attributes: ['id', ['name', 'username']] }) ==> will return the user's name as username
- [FEATURE] cross-database support. currently supported: mysql, sqlite
- [FEATURE] migrations
- [TEST] removed all expresso tests and converted them to jasmine

# v1.2.1 #
- [REFACTORING] renamed the global options for sync, query and define on sequelize; before: options.queryOptions; now: options.query
- [FEATURE] allow definition of charset via global define option in sequelize or via charset option in sequelize.define
- [FEATURE] allow definition of mysql engine via global define option in sequelize or via engine option in sequelize.define; default is InnoDB now
- [FEATURE] find and findAll will now search in a list of values via: Model.findAll({where: { id: [1,2,3] }}); will return all models with id 1, 2 and 3
- [TEST] force latin1 charset for travis

# v1.2.0 #
- [FEATURE] min/max function for models, which return the min/max value in a column
- [FEATURE] getModel for modelManager for getting a model without storing it in a variable; use it via sequelize.modelManager.getModel('User')
- [TEST] test suite refactoring for jasmine

# v1.1.4 #
- [BUG] tables with identical prefix (e.g. wp_) can now be used in many-to-many associations

# v1.1.3 #
- [BUG] scoped options in model => a model can now have the attribute options
- [FEATURE] added drop method for sequelize, that drops all currently registered tables

# v1.1.2 #
- [BUG] prevent malfunction after being idle

# v1.1.1 #
- [BUG] fixed memory leaks
- [FEATURE] added query queueing (adjustable via maxConcurrentQueries in config; default: 50)

# v1.1.0 #
- [BUG] defaultValue 0 is now working
- [REMOVED] mysql-pool usage (will give it a new try later)
- [CHORE] updated node-mysql to 0.9.4

# v1.0.2 #
- [BUG] Fixed where clause generation for models with explicit primary keys (allanca)
- [BUG] Set insertId for non-default auto increment fields (allanca)

# v1.0.1 #
- [FEATURE] Added Model.count(callback), which returns the number of elements saved in the database
- [BUG] Fixed self associations

# v1.0.0 #
- complete rewrite
- added new emitter syntax
- sql injection protection
- select now supports hash usage of where
- select now supports array usage of where
- added a lot of options to find/findAll
- Wrapped queries correctly using `foo`
- using expresso 0.7.2
- moved config for test database into seperated config file
- Added method for adding and deleting single associations

# v0.4.3 #
- renamed loadAssociatedData to fetchAssociations
- renamed Model#associatedData to fetchedAssociations
- added fetchAssociations to finder methods
- store data found by finder method in the associatedData hash + grep them from there if reload is not forced
- added option to sequelize constructor for disabling the pluralization of tablenames: disableTableNameModification
- allow array as value for chainQueries => Sequelize.chainQueries([save: [a,b,c]], callback)
- remove the usage of an array => Sequelize.chainQueries({save: a}, {destroy: b}, callback)

# v0.4.2 #
- fixed bugs from 0.4.1
- added the model instance method loadAssociatedData which adds the hash Model#associatedData to an instance which contains all associated data

# v0.4.1 #
- THIS UPDATE CHANGES TABLE STRUCTURES MASSIVELY!
- MAKE SURE TO DROP YOUR CURRENT TABLES AND LET THEM CREATE AGAIN!

- names of many-to-many-association-tables are chosen from passed association names
- foreign keys are chosen from passed association name
- added many-to-many association on the same model
- added hasManyAndBelongsTo
- added hasOneAndBelongsTo
- nodejs-mysql-native 0.4.2

# v0.4.0 #
- added error handling when defining invalid database credentials
- Sequelize#sync, Sequelize#drop, model#sync, model#drop returns errors via callback
- code is now located under lib/sequelize to use it with nDistro
- added possibility to use non default mysql database (host/port)
- added error handling when defining invalid database port/host
- schema definitions can now contain default values and null allowance
- database credentials can now also contain an empty / no password

# v0.3.0 #
- added possibility to define class and instance methods for models
- added import method for loading model definition from a file

# v0.2.6 #
- refactored Sequelize to fit CommonJS module conventions

# v0.2.5 #
- added BOOLEAN type
- added FLOAT type
- fixed DATE type issue
- fixed npm package

# v0.2.4 #
- fixed bug when using cross associated tables (many to many associations)

# v0.2.3 #
- added latest mysql connection library
  - fixed id handling on save
  - fixed text handling (varchar > 255; text)
- using the inflection library for naming tables more convenient
- Sequelize.TEXT is now using MySQL datatype TEXT instead of varchar(4000)

# v0.2.2 #
- released project as npm package

# v0.2.1 #
- fixed date bug

# v0.2.0 #
- added methods for setting associations
- added method for chaining an arbitraty amount of queries

# v0.1.0 #
- first stable version
- implemented all basic functions
- associations are working
