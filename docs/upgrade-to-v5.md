# Upgrade to v5

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

### Others

Sequelize now use parameterized queries for all INSERT / UPDATE operations (except UPSERT). They provide better protection against SQL Injection attack.

`ValidationErrorItem` now holds reference to original error in the `original` property, rather than the `__raw` property.

[retry-as-promised](https://github.com/mickhansen/retry-as-promised) has been updated to `3.0.0`, which use [any-promise](https://github.com/kevinbeaty/any-promise). This module repeat all `sequelize.query` operations. You can configure `any-promise` to use `bluebird` for better performance on Node 4 or 6


### Removed

- package: terraformer-wkt-parser [#9545](https://github.com/sequelize/sequelize/pull/9545)


## Changelog

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
