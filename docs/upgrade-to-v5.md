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

### Pooling

With v5 Sequelize now use `sequelize-pool` which is a modernized fork of `generic-pool@2.5`. You no longer need to call `sequelize.close` to shutdown pool, this helps with lambda executions. [#8468](https://github.com/sequelize/sequelize/issues/8468)

### Model

**Validators**

Custom validators defined per attribute (as opposed to the custom validators defined in the model's options) now run when the attribute's value is `null` and `allowNull` is `true` (while previously they didn't run and the validation succeeded immediately). To avoid problems when upgrading, please check all your custom validators defined per attribute, where `allowNull` is `true`, and make sure all these validators behave correctly when the value is `null`. See [#9143](https://github.com/sequelize/sequelize/issues/9143).

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

**Removed aliases**

Many model based aliases has been removed [#9372](https://github.com/sequelize/sequelize/issues/9372)

| Removed in v5 | Official Alternative |
| :------ | :------ |
| insertOrUpdate | upsert |
| find | findOne |
| findAndCount | findAndCountAll |
| findOrInitialize | findOrBuild |
| updateAttributes | update |
| findById, findByPrimary	| findByPk |
| all | findAll |
| hook | addHook |

### Datatypes

**Range**

Now supports only one standard format `[{ value: 1, inclusive: true }, { value: 20, inclusive: false }]` [#9364](https://github.com/sequelize/sequelize/pull/9364)

**Network types**

Added support for `CIDR`, `INET` and `MACADDR` for Postgres

**Case insensitive text**

Added support for `CITEXT` for Postgres and SQLite

**Removed**

`NONE` type has been removed, use `VIRTUAL` instead

### Hooks

**Removed aliases**

Hooks aliases has been removed [#9372](https://github.com/sequelize/sequelize/issues/9372)

| Removed in v5 | Official Alternative |
| :------ | :------ |
| [after,before]BulkDelete | [after,before]BulkDestroy |
| [after,before]Delete | [after,before]Destroy |
| beforeConnection | beforeConnect |

### Sequelize

**Removed aliases**

Prototype references for many constants, objects and classes has been removed [#9372](https://github.com/sequelize/sequelize/issues/9372)

| Removed in v5 | Official Alternative |
| :------ | :------ |
| Sequelize.prototype.Utils	| Sequelize.Utils	|
| Sequelize.prototype.Promise	| Sequelize.Promise	|
| Sequelize.prototype.TableHints | Sequelize.TableHints	|
| Sequelize.prototype.Op | Sequelize.Op	|
| Sequelize.prototype.Transaction	| Sequelize.Transaction	|
| Sequelize.prototype.Model	| Sequelize.Model	|
| Sequelize.prototype.Deferrable | Sequelize.Deferrable	|
| Sequelize.prototype.Error	| Sequelize.Error	|
| Sequelize.prototype[error] | Sequelize[error] |

```js
import Sequelize from 'sequelize';
const sequelize = new Sequelize('postgres://user:password@127.0.0.1:mydb');

/**
 * In v4 you can do this
 */
console.log(sequelize.Op === Sequelize.Op) // logs `true`
console.log(sequelize.UniqueConstraintError === Sequelize.UniqueConstraintError) // logs `true`

Model.findAll({
  where: {
    [sequelize.Op.and]: [ // Using sequelize.Op or Sequelize.Op interchangeably
      {
        name: "Abc"
      },
      {
        age: {
          [Sequelize.Op.gte]: 18
        }
      }
    ]
  }
}).catch(sequelize.ConnectionError, () => {
  console.error('Something wrong with connection?');
});

/**
 * In v5 aliases has been removed from Sequelize prototype
 * You should use Sequelize directly to access Op, Errors etc
 */

Model.findAll({
  where: {
    [Sequelize.Op.and]: [ // Dont use sequelize.Op, use Sequelize.Op instead
      {
        name: "Abc"
      },
      {
        age: {
          [Sequelize.Op.gte]: 18
        }
      }
    ]
  }
}).catch(Sequelize.ConnectionError, () => {
  console.error('Something wrong with connection?');
});
```

### Query Interface

- `changeColumn` no longer generates constraint with `_idx` suffix. Now Sequelize does not specify any name for constraints thus defaulting to database engine naming. This aligns behavior of `sync`, `createTable` and `changeColumn`.

### Others

- Sequelize now use parameterized queries for all INSERT / UPDATE operations (except UPSERT). They provide better protection against SQL Injection attack.
- `ValidationErrorItem` now holds reference to original error in the `original` property, rather than the `__raw` property.
- [retry-as-promised](https://github.com/mickhansen/retry-as-promised) has been updated to `3.1.0`, which use [any-promise](https://github.com/kevinbeaty/any-promise). This module repeat all `sequelize.query` operations. You can configure `any-promise` to use `bluebird` for better performance on Node 4 or 6
- Sequelize will throw for all `undefined` keys in `where` options, In past versions `undefined` was converted to `null`.


### Packages

- removed: terraformer-wkt-parser [#9545](https://github.com/sequelize/sequelize/pull/9545)
- mysql2: use `1.5.2` or above to support prepared statements
- updated: retry-as-promised: `3.1.0`
- change: `generic-pool` to `sequelize-pool`

## Changelog

### 5.0.0-beta.16

- feat: add typescript typings [#10287](https://github.com/sequelize/sequelize/pull/10117)
- fix(mysql): match with newlines in error message [#10320](https://github.com/sequelize/sequelize/pull/10320)
- fix(update): skips update when nothing to update [#10248](https://github.com/sequelize/sequelize/pull/10248)
- fix(utils): flattenObject for null values [#10293](https://github.com/sequelize/sequelize/pull/10293)
- fix(instance-validator): don't skip custom validators on null [#9143](https://github.com/sequelize/sequelize/pull/9143)
- docs(transaction): after save example [#10280](https://github.com/sequelize/sequelize/pull/10280)
- docs(query-generator): typo [#10277](https://github.com/sequelize/sequelize/pull/10277)
- refactor(errors): restructure [#10355](https://github.com/sequelize/sequelize/pull/10355)
- refactor(scope): documentation #9087 [#10312](https://github.com/sequelize/sequelize/pull/10312)
- refactor: cleanup association and spread use [#10276](https://github.com/sequelize/sequelize/pull/10276)

### 5.0.0-beta.15

- fix(query-generator): fix addColumn create comment [#10117](https://github.com/sequelize/sequelize/pull/10117)
- fix(sync): throw when no models defined [#10175](https://github.com/sequelize/sequelize/pull/10175)
- fix(association): enable eager load with include all(#9928) [#10173](https://github.com/sequelize/sequelize/pull/10173)
- fix(sqlite): simplify connection error handling
- fix(model): prevent version number from being incremented as string [#10217](https://github.com/sequelize/sequelize/pull/10217)
- feat(dialect): mariadb [#10192](https://github.com/sequelize/sequelize/pull/10192)
- docs(migrations): improve dialect options docs
- docs: fix favicon [#10242](https://github.com/sequelize/sequelize/pull/10242)
- docs(model.init): `attribute.column.validate` option [#10237](https://github.com/sequelize/sequelize/pull/10237)
- docs(bulk-create): update support information about ignoreDuplicates
- docs: explain custom/new data types [#10170](https://github.com/sequelize/sequelize/pull/10170)
- docs(migrations): Simplify CLI Call [#10201](https://github.com/sequelize/sequelize/pull/10201)
- docs(migrations): added advanced skeleton example [#10190](https://github.com/sequelize/sequelize/pull/10190)
- docs(transaction): default isolation level [#10111](https://github.com/sequelize/sequelize/pull/10111)
- docs: typo in associations.md [#10157](https://github.com/sequelize/sequelize/pull/10157)
- refactor: reduce code complexity [#10120](https://github.com/sequelize/sequelize/pull/10120)
- refactor: optimize memoize use, misc cases [#10122](https://github.com/sequelize/sequelize/pull/10122)
- chore(lint): enforce consistent spacing [#10193](https://github.com/sequelize/sequelize/pull/10193)



### 5.0.0-beta.14

- fix(query): correctly quote identifier for attributes (#9964) [#10118](https://github.com/sequelize/sequelize/pull/10118)
- feat(postgres): dyanmic oids [#10077](https://github.com/sequelize/sequelize/pull/10077)
- fix(error): optimistic lock message [#10068](https://github.com/sequelize/sequelize/pull/10068)
- fix(package): update depd to version 2.0.0 [#10081](https://github.com/sequelize/sequelize/pull/10081)
- fix(model): validate virtual attribute (#9947) [#10085](https://github.com/sequelize/sequelize/pull/10085)
- fix(test): actually test get method with raw option [#10059](https://github.com/sequelize/sequelize/pull/10059)
- fix(model): return deep cloned value for toJSON [#10058](https://github.com/sequelize/sequelize/pull/10058)
- fix(model): create instance with many-to-many association with extra column (#10034) [#10050](https://github.com/sequelize/sequelize/pull/10050)
- fix(query-generator): fix bad property access [#10056](https://github.com/sequelize/sequelize/pull/10056)
- docs(upgrade-to-v4): typo [#10060](https://github.com/sequelize/sequelize/pull/10060)
- docs(model-usage): order expression format [#10061](https://github.com/sequelize/sequelize/pull/10061)
- chore(package): update retry-as-promised to version 3.1.0 [#10065](https://github.com/sequelize/sequelize/pull/10065)
- refactor(scopes): just in time options conforming [#9735](https://github.com/sequelize/sequelize/pull/9735)
- refactor: use sequelize-pool for pooling [#10051](https://github.com/sequelize/sequelize/pull/10051)
- refactor(*): cleanup code [#10091](https://github.com/sequelize/sequelize/pull/10091)
- refactor: use template strings [#10055](https://github.com/sequelize/sequelize/pull/10055)
- refactor(query-generation): cleanup template usage [#10047](https://github.com/sequelize/sequelize/pull/10047)

### 5.0.0-beta.13

- fix: throw on undefined where parameters [#10048](https://github.com/sequelize/sequelize/pull/10048)
- fix(model): improve wrong alias error message [#10041](https://github.com/sequelize/sequelize/pull/10041)
- feat(sqlite): CITEXT datatype [#10036](https://github.com/sequelize/sequelize/pull/10036)
-  fix(postgres): remove if not exists and cascade from create/drop database queries [#10033](https://github.com/sequelize/sequelize/pull/10033)
- fix(syntax): correct parentheses around union [#10003](https://github.com/sequelize/sequelize/pull/10003)
- feat(query-interface): createDatabase / dropDatabase support [#10027](https://github.com/sequelize/sequelize/pull/10027)
- feat(postgres): CITEXT datatype [#10024](https://github.com/sequelize/sequelize/pull/10024)
- feat: pass uri query parameters to dialectOptions [#10025](https://github.com/sequelize/sequelize/pull/10025)
- docs(query-generator): remove doc about where raw query [#10017](https://github.com/sequelize/sequelize/pull/10017)
- fix(query): handle undefined field on unique constraint error [#10018](https://github.com/sequelize/sequelize/pull/10018)
- fix(model): sum returns zero when empty matching [#9984](https://github.com/sequelize/sequelize/pull/9984)
- feat(query-generator): add startsWith, endsWith and substring operators [#9999](https://github.com/sequelize/sequelize/pull/9999)
- docs(sequelize): correct jsdoc annotations for authenticate [#10002](https://github.com/sequelize/sequelize/pull/10002)
- docs(query-interface): add bulkUpdate docs [#10005](https://github.com/sequelize/sequelize/pull/10005)
- fix(tinyint): ignore params for TINYINT on postgres [#9992](https://github.com/sequelize/sequelize/pull/9992)
- fix(belongs-to): create now returns target model [#9980](https://github.com/sequelize/sequelize/pull/9980)
- refactor(model): remove .all alias [#9975](https://github.com/sequelize/sequelize/pull/9975)
- perf: fix memory leak due to instance reference by isImmutable [#9973](https://github.com/sequelize/sequelize/pull/9973)
- feat(sequelize): dialectModule option [#9972](https://github.com/sequelize/sequelize/pull/9972)
- fix(query): check valid warn message [#9948](https://github.com/sequelize/sequelize/pull/9948)
- fix(model): check for own property when overriding association mixins [#9953](https://github.com/sequelize/sequelize/pull/9953)
- fix(create-table): support for uniqueKeys [#9946](https://github.com/sequelize/sequelize/pull/9946)
- refactor(transaction): remove autocommit mode [#9921](https://github.com/sequelize/sequelize/pull/9921)
- feat(sequelize): getDatabaseName [#9937](https://github.com/sequelize/sequelize/pull/9937)
- refactor: remove aliases [#9933](https://github.com/sequelize/sequelize/pull/9933)
- feat(belongsToMany): override unique constraint name with uniqueKey [#9914](https://github.com/sequelize/sequelize/pull/9914)
- fix(postgres): properly disconnect connections [#9911](https://github.com/sequelize/sequelize/pull/9911)
- docs(instances.md): add section for restore() [#9917](https://github.com/sequelize/sequelize/pull/9917)
- docs(hooks.md): add warning about memory limits of individual hooks [#9881](https://github.com/sequelize/sequelize/pull/9881)
- fix(package): update debug to version 4.0.0 [#9908](https://github.com/sequelize/sequelize/pull/9908)
- feat(postgres): support ignoreDuplicates with ON CONFLICT DO NOTHING [#9883](https://github.com/sequelize/sequelize/pull/9883)

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
