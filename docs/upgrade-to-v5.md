# Upgrade to v5-beta

Sequelize v5 is the next major release after v4

## Breaking Changes

### Support for Node 6 and up

Sequelize v5 will only support Node 6 and up [#9015](https://github.com/sequelize/sequelize/issues/9015)

### Secure Operators

With v4 you started to get a deprecation warning `String based operators are now deprecated`. Also concept of operators was introduced. These operators are Symbols which prevent hash injection attacks.

http://docs.sequelizejs.com/manual/tutorial/querying.html#operators-security

**With v5**

- Operators are now enabled by default.
- You can still use string operators by passing an operators map in `operatorsAliases`, but that will give you deprecation warning.
- Op.$raw is removed

### Model

**Attributes**

`Model.attributes` now removed, use `Model.rawAttributes`. [#5320](https://github.com/sequelize/sequelize/issues/5320)

__Note__: _Please don't confuse this with `options.attributes`, they are still valid_

**Paranoid Mode**

With v5 if `deletedAt` is set, record will be considered as deleted. `paranoid` option will only use `deletedAt` as flag. [#8496](https://github.com/sequelize/sequelize/issues/8496)

**Model.bulkCreate**

`updateOnDuplicate` option which used to accept boolean and array, now only accepts non-empty array of attributes. [#9288](https://github.com/sequelize/sequelize/issues/9288)


**Underscored Mode**

Implementation of `Model.options.underscored` is changed. You can find full specifications [here](https://github.com/sequelize/sequelize/issues/6423#issuecomment-379472035).

Main outline

1. Both `underscoredAll` and `underscored` options are merged into single `underscored` option
2. All attributes are now generated with camelcase naming by default. With the `underscored` option set to `true`, the `field` option for attributes will be set as underscored version of attribute name.
3. `underscored` will control all attributes including timestamps, version and foreign keys. It will not affect any attribute which already specifies the `field` option.

[#9304](https://github.com/sequelize/sequelize/pull/9304)

### Datatypes

**Postgres Range**

Now supports only one standard format `[{ value: 1, inclusive: true }, { value: 20, inclusive: false }]` [#9364](https://github.com/sequelize/sequelize/pull/9364)

**Network types**

Added support for `CIDR`, `INET` and `MACADDR` for Postgres

### Query Interface

- `changeColumn` no longer generates constraint with `_idx` suffix. Now Sequelize does not specify any name for constraints thus defaulting to database engine naming. This aligns behavior of `sync`, `createTable` and `changeColumn`.

### Others

- Sequelize now use parameterized queries for all INSERT / UPDATE operations (except UPSERT). They provide better protection against SQL Injection attack.
- `ValidationErrorItem` now holds reference to original error in the `original` property, rather than the `__raw` property.
- [retry-as-promised](https://github.com/mickhansen/retry-as-promised) has been updated to `3.0.0`, which use [any-promise](https://github.com/kevinbeaty/any-promise). This module repeat all `sequelize.query` operations. You can configure `any-promise` to use `bluebird` for better performance on Node 4 or 6
- Sequelize will ignore all `undefined` keys in `where` options, In past versions `undefined` was converted to `null`. For `BULKUPDATE / BULKDELETE` query types passing undefined keys in where options will throw an error.


### Packages

- removed: terraformer-wkt-parser [#9545](https://github.com/sequelize/sequelize/pull/9545)
- mysql2: use `1.5.2` or above to support prepared statements

## Changelog

### 5.0.0-beta.12

- fix(changeColumn): normalize attribute [#9897](https://github.com/sequelize/sequelize/pull/9897)
- feat(describeTable): support string length for mssql [#9896](https://github.com/sequelize/sequelize/pull/9896)
- feat(describeTable): support autoIncrement for mysql [#9894](https://github.com/sequelize/sequelize/pull/9894)
- fix(sqlite): unable to reference foreignKey on primaryKey [#9893](https://github.com/sequelize/sequelize/pull/9893)
- fix(postgres): enum with string COMMENT breaks query [#9891](https://github.com/sequelize/sequelize/pull/9891)
- fix(changeColumn): use engine defaults for foreign/unique key naming [#9890](https://github.com/sequelize/sequelize/pull/9890)
- fix(transaction): fixed unhandled rejection when connection acquire timeout [#9879](https://github.com/sequelize/sequelize/pull/9879)
- fix(sqlite): close connection properly and cleanup files [#9851](https://github.com/sequelize/sequelize/pull/9851)
- fix(model): incorrect error message for findCreateFind [#9849](https://github.com/sequelize/sequelize/pull/9849)

### 5.0.0-beta.11

- fix(count): duplicate mapping of fields break scopes [#9788](https://github.com/sequelize/sequelize/pull/9788)
- fix(model): bulkCreate should populate dataValues directly [#9797](https://github.com/sequelize/sequelize/pull/9797)
- fix(mysql): improve unique key violation handling [#9724](https://github.com/sequelize/sequelize/pull/9724)
- fix(separate): don't propagate group to separated queries [#9754](https://github.com/sequelize/sequelize/pull/9754)
- fix(scope): incorrect query generated when sequelize.fn used with scopes [#9730](https://github.com/sequelize/sequelize/pull/9730)
- fix(json): access included data with attributes [#9662](https://github.com/sequelize/sequelize/pull/9662)
- (fix): pass offset in UNION'ed queries [#9577](https://github.com/sequelize/sequelize/pull/9577)
- fix(destroy): attributes updated in a beforeDestroy hook are now persisted on soft delete [#9319](https://github.com/sequelize/sequelize/pull/9319)
- fix(addScope): only throw when defaultScope is defined [#9703](https://github.com/sequelize/sequelize/pull/9703)


### 5.0.0-beta.10

- fix(belongsToMany): association.add returns array of array of through records [#9700](https://github.com/sequelize/sequelize/pull/9700)
- feat: association hooks [#9590](https://github.com/sequelize/sequelize/pull/9590)
- fix(bulkCreate): dont map dataValue to fields for individualHooks:true[#9672](https://github.com/sequelize/sequelize/pull/9672)
- feat(postgres): drop enum support [#9641](https://github.com/sequelize/sequelize/pull/9641)
- feat(validation): improve validation for type[#9660](https://github.com/sequelize/sequelize/pull/9660)
- feat: allow querying sqlite_master table [#9645](https://github.com/sequelize/sequelize/pull/9645)
- fix(hasOne.sourceKey): setup sourceKeyAttribute for joins [#9658](https://github.com/sequelize/sequelize/pull/9658)
- fix: throw when type of array values is not defined [#9649](https://github.com/sequelize/sequelize/pull/9649)
- fix(query-generator): ignore undefined keys in query [#9548](https://github.com/sequelize/sequelize/pull/9548)
- fix(model): unable to override rejectOnEmpty [#9632](https://github.com/sequelize/sequelize/pull/9632)
- fix(reload): instance.changed() remains unaffected [#9615](https://github.com/sequelize/sequelize/pull/9615)
- feat(model): column level comments [#9573](https://github.com/sequelize/sequelize/pull/9573)
- docs: cleanup / correct jsdoc references [#9702](https://github.com/sequelize/sequelize/pull/9702)


### 5.0.0-beta.9

- fix(model): ignore undefined values in update payload [#9587](https://github.com/sequelize/sequelize/pull/9587)
- fix(mssql): set encrypt as default false for dialect options [#9588](https://github.com/sequelize/sequelize/pull/9588)
- fix(model): ignore VIRTUAL/getters with attributes.exclude [#9568](https://github.com/sequelize/sequelize/pull/9568)
- feat(data-types): CIDR, INET, MACADDR support for Postgres [#9567](https://github.com/sequelize/sequelize/pull/9567)
- fix: customize allowNull message with notNull validator [#9549](https://github.com/sequelize/sequelize/pull/9549)

### 5.0.0-beta.8

- feat(query-generator): Generate INSERT / UPDATE using bind parameters [#9431](https://github.com/sequelize/sequelize/pull/9431) [#9492](https://github.com/sequelize/sequelize/pull/9492)
- performance: remove terraformer-wkt-parser dependency [#9545](https://github.com/sequelize/sequelize/pull/9545)
- fix(constructor): set username, password, database via options in addition to connection string[#9517](https://github.com/sequelize/sequelize/pull/9517)
- fix(associations/belongs-to-many): catch EmptyResultError in set/add helpers [#9535](https://github.com/sequelize/sequelize/pull/9535)
- fix: sync with alter:true doesn't use field name [#9529](https://github.com/sequelize/sequelize/pull/9529)
- fix(UnknownConstraintError): improper handling of error options [#9547](https://github.com/sequelize/sequelize/pull/9547)

### 5.0.0-beta.7

- fix(data-types/blob): only return null for mysql binary null [#9441](https://github.com/sequelize/sequelize/pull/9441)
- fix(errors): use standard .original rather than .__raw for actual error
- fix(connection-manager): mssql datatype parsing [#9470](https://github.com/sequelize/sequelize/pull/9470)
- fix(query/removeConstraint): support schemas
- fix: use Buffer.from
- fix(transactions): return patched promise from sequelize.query [#9473](https://github.com/sequelize/sequelize/pull/9473)

### 5.0.0-beta.6

- fix(postgres/query-generator): syntax error with auto-increment SMALLINT [#9406](https://github.com/sequelize/sequelize/pull/9406)
- fix(postgres/range): inclusive property lost in JSON format [#8471](https://github.com/sequelize/sequelize/issues/8471)
- fix(postgres/range): range bound not applied [#8176](https://github.com/sequelize/sequelize/issues/8176)
- fix(mssql): no unique constraint error thrown for PRIMARY case [#9415](https://github.com/sequelize/sequelize/pull/9415)
- fix(query-generator): regexp operator escaping
- docs: various improvements and hinting update

### 5.0.0-beta.5

- fix: inject foreignKey when using separate:true [#9396](https://github.com/sequelize/sequelize/pull/9396)
- fix(isSoftDeleted): just use deletedAt as flag
- feat(hasOne): sourceKey support with key validation [#9382](https://github.com/sequelize/sequelize/pull/9382)
- fix(query-generator/deleteQuery): remove auto limit [#9377](https://github.com/sequelize/sequelize/pull/9377)
- feat(postgres): skip locked support [#9197](https://github.com/sequelize/sequelize/pull/9197)
- fix(mssql): case sensitive operation fails because of uppercased system table references [#9337](https://github.com/sequelize/sequelize/pull/9337)

### 5.0.0-beta.4

- change(model): setDataValue should not mark null to null as changed [#9347](https://github.com/sequelize/sequelize/pull/9347)
- change(mysql/connection-manager): do not execute SET time_zone query if keepDefaultTimezone config is true [#9358](https://github.com/sequelize/sequelize/pull/9358)
- feat(transactions): Add afterCommit hooks for transactions [#9287](https://github.com/sequelize/sequelize/pull/9287)

### 5.0.0-beta.3

- change(model): new options.underscored implementation [#9304](https://github.com/sequelize/sequelize/pull/9304)
- fix(mssql): duplicate order generated with limit offset [#9307](https://github.com/sequelize/sequelize/pull/9307)
- fix(scope): do not assign scope on eagerly loaded associations [#9292](https://github.com/sequelize/sequelize/pull/9292)
- change(bulkCreate): only support non-empty array as updateOnDuplicate

### 5.0.0-beta.2

- change(operators): Symbol operators now enabled by default, removed deprecation warning
- fix(model): don't add LIMIT in findOne() queries on unique key [#9248](https://github.com/sequelize/sequelize/pull/9248)
- fix(model): use schema when generating foreign keys [#9029](https://github.com/sequelize/sequelize/issues/9029)

### 5.0.0-beta.1

- fix(postgres): reserved words support [#9236](https://github.com/sequelize/sequelize/pull/9236)
- fix(findOrCreate): warn and handle unknown attributes in defaults
- fix(query-generator): 1-to-many join in subQuery filter missing where clause [#9228](https://github.com/sequelize/sequelize/issues/9228)

### 5.0.0-beta

- `Model.attributes` now removed, use `Model.rawAttributes` [#5320](https://github.com/sequelize/sequelize/issues/5320)
- `paranoid` mode will now treat any record with `deletedAt` as deleted [#8496](https://github.com/sequelize/sequelize/issues/8496)
- Node 6 and up [#9015](https://github.com/sequelize/sequelize/issues/9015)
