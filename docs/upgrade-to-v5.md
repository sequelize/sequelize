# Upgrade to v5

Sequelize v5 is the next major release after v4

## Breaking Changes

### Support for Node 6 and up

Sequelize v5 will only support Node 6 and up [#9015](https://github.com/sequelize/sequelize/issues/9015)

__DEV__: _Done, no deprecation_

### Secure Operators

With v4 you started to get a deprecation warning `String based operators are now deprecated`. Also concept of operators was introduced. These operators are Symbols which prevent hash injection attacks.

Please check these threads to know more

- (Issue) https://github.com/sequelize/sequelize/issues/7310
- (Fix) https://github.com/sequelize/sequelize/pull/8240
- (Explanation) https://github.com/sequelize/sequelize/issues/8417#issuecomment-334056048
- (Official Docs) http://docs.sequelizejs.com/manual/tutorial/querying.html#operators-security

With v5

- Operators are now enabled by default.
- You can still use string operators by passing an operators map in `operatorsAliases`
- Op.$raw is removed


__DEV__: _Incomplete, deprecated_

### Model

**Attributes**

`Model.attributes` now removed, use `Model.rawAttributes`. [#5320](https://github.com/sequelize/sequelize/issues/5320)

__Note__: _Please dont confuse this with `options.attributes`, they are still valid_

__DEV__: _Done, no deprecation_

**Paranoid Mode**

With v5 if `deletedAt` is set, record will be considered as deleted. So `paranoid` option will only use `deletedAt` as flag.

In v4 it used to compare current time with `deletedAt`. [#8496](https://github.com/sequelize/sequelize/issues/8496)

__DEV__: _Done, no deprecation_

## Changelog


### 5.0.0-beta

- `Model.attributes` now removed, use `Model.rawAttributes` [#5320](https://github.com/sequelize/sequelize/issues/5320)
- `paranoid` mode will now treat any record with `deletedAt` as deleted [#8496](https://github.com/sequelize/sequelize/issues/8496)
- Node 6 and up [#9015](https://github.com/sequelize/sequelize/issues/9015)
