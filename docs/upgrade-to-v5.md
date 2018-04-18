# Upgrade to v5

Sequelize v5 is the next major release after v4

## Breaking Changes

### Support for Node 6 and up

Sequelize v5 will only support Node 6 and up [#9015](https://github.com/sequelize/sequelize/issues/9015)

### Secure Operators

With v4 you started to get a deprecation warning `String based operators are now deprecated`. Also concept of operators was introduced. These operators are Symbols which prevent hash injection attacks.

**With v5**

- Operators are now enabled by default.
- You can still use string operators by passing an operators map in `operatorsAliases`, but that will give you deprecation warning.
- Op.$raw is removed

Please check these threads to know more

- (Issue) https://github.com/sequelize/sequelize/issues/7310
- (Fix) https://github.com/sequelize/sequelize/pull/8240
- (Explanation) https://github.com/sequelize/sequelize/issues/8417#issuecomment-334056048
- (Official Docs) http://docs.sequelizejs.com/manual/tutorial/querying.html#operators-security

### Model

**Attributes**

`Model.attributes` now removed, use `Model.rawAttributes`. [#5320](https://github.com/sequelize/sequelize/issues/5320)

__Note__: _Please dont confuse this with `options.attributes`, they are still valid_

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


## Changelog

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
