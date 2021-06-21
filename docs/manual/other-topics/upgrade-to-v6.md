# Upgrade to v6

Sequelize v6 is the next major release after v5. Below is a list of breaking changes to help you upgrade.

## Breaking Changes

### Support for Node 10 and up

Sequelize v6 will only support Node 10 and up [#10821](https://github.com/sequelize/sequelize/issues/10821).

### CLS

You should now use [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked) package for CLS support.

```js
const cls = require("cls-hooked");
const namespace = cls.createNamespace("....");
const Sequelize = require("sequelize");

Sequelize.useCLS(namespace);
```

### Database Engine Support

We have updated our minimum supported database engine versions. Using older database engine will show `SEQUELIZE0006` deprecation warning. Please check [ENGINE.md](https://github.com/sequelize/sequelize/blob/main/ENGINE.md) for version table.

### Sequelize

- Bluebird has been removed. Internally all methods are now using async/await. Public API now returns native promises. Thanks to [Andy Edwards](https://github.com/jedwards1211) for this refactor work.
- `Sequelize.Promise` is no longer available.
- `sequelize.import` method has been removed. CLI users should update to `sequelize-cli@6`.
- All instances of QueryInterface and QueryGenerator have been renamed to their lowerCamelCase variants eg. queryInterface and queryGenerator when used as property names on Model and Dialect, the class names remain the same.

### Model

#### `options.returning`

Option `returning: true` will no longer return attributes that are not defined in the model. Old behavior can be achieved by using `returning: ['*']` instead.

#### `Model.changed()`

This method now tests for equality with [`_.isEqual`](https://lodash.com/docs/4.17.15#isEqual) and is now deep aware for JSON objects. Modifying a nested value for a JSON object won't mark it as changed (since it is still the same object).

```js
const instance = await MyModel.findOne();

instance.myJsonField.someProperty = 12345; // Changed from something else to 12345
console.log(instance.changed()); // false

await instance.save(); // this will not save anything

instance.changed("myJsonField", true);
console.log(instance.changed()); // ['myJsonField']

await instance.save(); // will save
```

#### `Model.bulkCreate()`

This method now throws `Sequelize.AggregateError` instead of `Bluebird.AggregateError`. All errors are now exposed as `errors` key.

#### `Model.upsert()`

Native upsert is now supported for all dialects.

```js
const [instance, created] = await MyModel.upsert({});
```

Signature for this method has been changed to `Promise<Model,boolean | null>`. First index contains upserted `instance`, second index contains a boolean (or `null`) indicating if record was created or updated. For SQLite/Postgres, `created` value will always be `null`.

- MySQL - Implemented with ON DUPLICATE KEY UPDATE
- PostgreSQL - Implemented with ON CONFLICT DO UPDATE
- SQLite - Implemented with ON CONFLICT DO UPDATE
- MSSQL - Implemented with MERGE statement

_<ins>Note for Postgres users:</ins>_ If upsert payload contains PK field, then PK will be used as the conflict target. Otherwise first unique constraint will be selected as the conflict key.

### QueryInterface

#### `addConstraint`

This method now only takes 2 parameters, `tableName` and `options`. Previously the second parameter could be a list of column names to apply the constraint to, this list must now be passed as `options.fields` property.

## Changelog

### 6.0.0-beta.7

- docs(associations): belongs to many create with through table
- docs(query-interface): fix broken links [#12272](https://github.com/sequelize/sequelize/pull/12272)
- docs(sequelize): omitNull only works for CREATE/UPDATE queries
- docs: asyncify [#12297](https://github.com/sequelize/sequelize/pull/12297)
- docs: responsive [#12308](https://github.com/sequelize/sequelize/pull/12308)
- docs: update feature request template
- feat(postgres): native upsert [#12301](https://github.com/sequelize/sequelize/pull/12301)
- feat(sequelize): allow passing dialectOptions.options from url [#12404](https://github.com/sequelize/sequelize/pull/12404)
- fix(include): check if attributes specified for included through model [#12316](https://github.com/sequelize/sequelize/pull/12316)
- fix(model.destroy): return 0 with truncate [#12281](https://github.com/sequelize/sequelize/pull/12281)
- fix(mssql): empty order array generates invalid FETCH statement [#12261](https://github.com/sequelize/sequelize/pull/12261)
- fix(postgres): parse enums correctly when describing a table [#12409](https://github.com/sequelize/sequelize/pull/12409)
- fix(query): ensure correct return signature for QueryTypes.RAW [#12305](https://github.com/sequelize/sequelize/pull/12305)
- fix(query): preserve cls context for logger [#12328](https://github.com/sequelize/sequelize/pull/12328)
- fix(query-generator): do not generate GROUP BY clause if options.group is empty [#12343](https://github.com/sequelize/sequelize/pull/12343)
- fix(reload): include default scope [#12399](https://github.com/sequelize/sequelize/pull/12399)
- fix(types): add Association into OrderItem type [#12332](https://github.com/sequelize/sequelize/pull/12332)
- fix(types): add clientMinMessages to Options interface [#12375](https://github.com/sequelize/sequelize/pull/12375)
- fix(types): transactionType in Options [#12377](https://github.com/sequelize/sequelize/pull/12377)
- fix(types): add support for optional values in "where" clauses [#12337](https://github.com/sequelize/sequelize/pull/12337)
- fix(types): add missing fields to 'FindOrCreateType' [#12338](https://github.com/sequelize/sequelize/pull/12338)
- fix: add missing sql and parameters properties to some query errors [#12299](https://github.com/sequelize/sequelize/pull/12299)
- fix: remove custom inspect [#12262](https://github.com/sequelize/sequelize/pull/12262)
- refactor: cleanup query generators [#12304](https://github.com/sequelize/sequelize/pull/12304)

### 6.0.0-beta.6

- docs(add-constraint): options.fields support
- docs(association): document uniqueKey for belongs to many [#12166](https://github.com/sequelize/sequelize/pull/12166)
- docs(association): options.through.where support
- docs(association): use and instead of 'a nd' [#12191](https://github.com/sequelize/sequelize/pull/12191)
- docs(association): use correct scope name [#12204](https://github.com/sequelize/sequelize/pull/12204)
- docs(manuals): avoid duplicate header ids [#12201](https://github.com/sequelize/sequelize/pull/12201)
- docs(model): correct syntax error in example code [#12137](https://github.com/sequelize/sequelize/pull/12137)
- docs(query-interface): removeIndex indexNameOrAttributes [#11947](https://github.com/sequelize/sequelize/pull/11947)
- docs(resources): add sequelize-guard library [#12235](https://github.com/sequelize/sequelize/pull/12235)
- docs(typescript): fix confusing comments [#12226](https://github.com/sequelize/sequelize/pull/12226)
- docs(v6-guide): bluebird removal API changes
- docs: database version support info [#12168](https://github.com/sequelize/sequelize/pull/12168)
- docs: remove remaining bluebird references [#12167](https://github.com/sequelize/sequelize/pull/12167)
- feat(belongs-to-many): allow creation of paranoid join tables [#12088](https://github.com/sequelize/sequelize/pull/12088)
- feat(belongs-to-many): get/has/count for paranoid join table [#12256](https://github.com/sequelize/sequelize/pull/12256)
- feat(pool): expose maxUses pool config option [#12101](https://github.com/sequelize/sequelize/pull/12101)
- feat(postgres): minify include aliases over limit [#11940](https://github.com/sequelize/sequelize/pull/11940)
- feat(sequelize): handle query string host value [#12041](https://github.com/sequelize/sequelize/pull/12041)
- fix(associations): ensure correct schema on all generated attributes [#12258](https://github.com/sequelize/sequelize/pull/12258)
- fix(docs/instances): use correct variable for increment [#12087](https://github.com/sequelize/sequelize/pull/12087)
- fix(include): separate queries are not sub-queries [#12144](https://github.com/sequelize/sequelize/pull/12144)
- fix(model): fix unchained promise in association logic in bulkCreate [#12163](https://github.com/sequelize/sequelize/pull/12163)
- fix(model): updateOnDuplicate handles composite keys [#11984](https://github.com/sequelize/sequelize/pull/11984)
- fix(model.count): distinct without any column generates invalid SQL [#11946](https://github.com/sequelize/sequelize/pull/11946)
- fix(model.reload): ignore options.where and always use this.where() [#12211](https://github.com/sequelize/sequelize/pull/12211)
- fix(mssql) insert record failure because of BOOLEAN column type [#12090](https://github.com/sequelize/sequelize/pull/12090)
- fix(mssql): cast sql_variant in query generator [#11994](https://github.com/sequelize/sequelize/pull/11994)
- fix(mssql): dont use OUTPUT INSERTED for update without returning [#12260](https://github.com/sequelize/sequelize/pull/12260)
- fix(mssql): duplicate order in FETCH/NEXT queries [#12257](https://github.com/sequelize/sequelize/pull/12257)
- fix(mssql): set correct scale for float [#11962](https://github.com/sequelize/sequelize/pull/11962)
- fix(mssql): tedious v9 requires connect call [#12182](https://github.com/sequelize/sequelize/pull/12182)
- fix(mssql): use uppercase for engine table and columns [#12212](https://github.com/sequelize/sequelize/pull/12212)
- fix(pool): show deprecation when engine is not supported [#12218](https://github.com/sequelize/sequelize/pull/12218)
- fix(postgres): addColumn support ARRAY(ENUM) [#12259](https://github.com/sequelize/sequelize/pull/12259)
- fix(query): do not bind \$ used within a whole-word [#12250](https://github.com/sequelize/sequelize/pull/12250)
- fix(query-generator): handle literal for substring based operators [#12210](https://github.com/sequelize/sequelize/pull/12210)
- fix(query-interface): allow passing null for query interface insert [#11931](https://github.com/sequelize/sequelize/pull/11931)
- fix(query-interface): allow sequelize.fn and sequelize.literal in fields of IndexesOptions [#12224](https://github.com/sequelize/sequelize/pull/12224)
- fix(scope): don't modify original scope definition [#12207](https://github.com/sequelize/sequelize/pull/12207)
- fix(sqlite): multiple primary keys results in syntax error [#12237](https://github.com/sequelize/sequelize/pull/12237)
- fix(sync): pass options to all query methods [#12208](https://github.com/sequelize/sequelize/pull/12208)
- fix(typings): add type_helpers to file list [#12000](https://github.com/sequelize/sequelize/pull/12000)
- fix(typings): correct Model.init return type [#12148](https://github.com/sequelize/sequelize/pull/12148)
- fix(typings): fn is assignable to where [#12040](https://github.com/sequelize/sequelize/pull/12040)
- fix(typings): getForeignKeysForTables argument definition [#12084](https://github.com/sequelize/sequelize/pull/12084)
- fix(typings): make between operator accept date ranges [#12162](https://github.com/sequelize/sequelize/pull/12162)
- refactor(ci): improve database wait script [#12132](https://github.com/sequelize/sequelize/pull/12132)
- refactor(tsd-test-setup): add & setup dtslint [#11879](https://github.com/sequelize/sequelize/pull/11879)
- refactor: move all dialect conditional logic into subclass [#12217](https://github.com/sequelize/sequelize/pull/12217)
- refactor: remove sequelize.import helper [#12175](https://github.com/sequelize/sequelize/pull/12175)
- refactor: use native versions [#12159](https://github.com/sequelize/sequelize/pull/12159)
- refactor: use object spread instead of Object.assign [#12213](https://github.com/sequelize/sequelize/pull/12213)

### 6.0.0-beta.5

- fix(find-all): throw on empty attributes [#11867](https://github.com/sequelize/sequelize/pull/11867)
- fix(types): `queryInterface.addIndex` [#11844](https://github.com/sequelize/sequelize/pull/11844)
- fix(types): `plain` option in `sequelize.query` [#11596](https://github.com/sequelize/sequelize/pull/11596)
- fix(types): correct overloaded method order [#11727](https://github.com/sequelize/sequelize/pull/11727)
- fix(types): `comparator` arg of `Sequelize.where` [#11843](https://github.com/sequelize/sequelize/pull/11843)
- fix(types): fix BelongsToManyGetAssociationsMixinOptions [#11818](https://github.com/sequelize/sequelize/pull/11818)
- fix(types): adds `hooks` to `CreateOptions` [#11736](https://github.com/sequelize/sequelize/pull/11736)
- fix(increment): broken queries [#11852](https://github.com/sequelize/sequelize/pull/11852)
- fix(associations): gets on many-to-many with non-primary target key [#11778](https://github.com/sequelize/sequelize11778/pull/)
- fix: properly select SRID if present [#11763](https://github.com/sequelize/sequelize/pull/11763)
- feat(sqlite): automatic path provision for `options.storage` [#11853](https://github.com/sequelize/sequelize/pull/11853)
- feat(postgres): `idle_in_transaction_session_timeout` connection option [#11775](https://github.com/sequelize/sequelize11775/pull/)
- feat(index): improve to support multiple fields with operator [#11934](https://github.com/sequelize/sequelize/pull/11934)
- docs(transactions): fix addIndex example and grammar [#11759](https://github.com/sequelize/sequelize/pull/11759)
- docs(raw-queries): remove outdated info [#11833](https://github.com/sequelize/sequelize/pull/11833)
- docs(optimistic-locking): fix missing manual [#11850](https://github.com/sequelize/sequelize/pull/11850)
- docs(model): findOne return value for empty result [#11762](https://github.com/sequelize/sequelize/pull/11762)
- docs(model-querying-basics.md): add some commas [#11891](https://github.com/sequelize/sequelize/pull/11891)
- docs(manuals): fix missing models-definition page [#11838](https://github.com/sequelize/sequelize/pull/11838)
- docs(manuals): extensive rewrite [#11825](https://github.com/sequelize/sequelize/pull/11825)
- docs(dialect-specific): add MSSQL domain auth example [#11799](https://github.com/sequelize/sequelize/pull/11799)
- docs(associations): fix typos in assocs manual [#11888](https://github.com/sequelize/sequelize/pull/11888)
- docs(associations): fix typo [#11869](https://github.com/sequelize/sequelize/pull/11869)

### 6.0.0-beta.4

- feat(sync): allow to bypass drop statements when sync with alter enabled [#11708](https://github.com/sequelize/sequelize/pull/11708)
- fix(model): injectDependentVirtualAttrs on included models [#11713](https://github.com/sequelize/sequelize/pull/11713)
- fix(model): generate ON CONFLICT ... DO UPDATE correctly [#11666](https://github.com/sequelize/sequelize/pull/11666)
- fix(mssql): optimize formatError RegEx [#11725](https://github.com/sequelize/sequelize/pull/11725)
- fix(types): add getForeignKeyReferencesForTable type [#11738](https://github.com/sequelize/sequelize/pull/11738)
- fix(types): add 'restore' hooks to types [#11730](https://github.com/sequelize/sequelize/pull/11730)
- fix(types): added 'fieldMaps' to QueryOptions typings [#11702](https://github.com/sequelize/sequelize/pull/11702)
- fix(types): add isSoftDeleted to Model [#11628](https://github.com/sequelize/sequelize/pull/11628)
- fix(types): fix upsert typing [#11674](https://github.com/sequelize/sequelize/pull/11674)
- fix(types): specified 'this' for getters and setters in fields [#11648](https://github.com/sequelize/sequelize/pull/11648)
- fix(types): add paranoid to UpdateOptions interface [#11647](https://github.com/sequelize/sequelize/pull/11647)
- fix(types): include 'as' in IncludeThroughOptions definition [#11624](https://github.com/sequelize/sequelize/pull/11624)
- fix(types): add Includeable to IncludeOptions.include type [#11622](https://github.com/sequelize/sequelize/pull/11622)
- fix(types): transaction lock [#11620](https://github.com/sequelize/sequelize/pull/11620)
- fix(sequelize.fn): escape dollarsign (#11533) [#11606](https://github.com/sequelize/sequelize/pull/11606)
- fix(types): add nested to Includeable [#11354](https://github.com/sequelize/sequelize/pull/11354)
- fix(types): add date to where [#11612](https://github.com/sequelize/sequelize/pull/11612)
- fix(types): add getDatabaseName (#11431) [#11614](https://github.com/sequelize/sequelize/pull/11614)
- fix(types): beforeDestroy [#11618](https://github.com/sequelize/sequelize/pull/11618)
- fix(types): query-interface table schema [#11582](https://github.com/sequelize/sequelize/pull/11582)
- docs: README.md [#11698](https://github.com/sequelize/sequelize/pull/11698)
- docs(sequelize): detail options.retry usage [#11643](https://github.com/sequelize/sequelize/pull/11643)
- docs: clarify logging option in Sequelize constructor [#11653](https://github.com/sequelize/sequelize/pull/11653)
- docs(migrations): fix syntax error in example [#11626](https://github.com/sequelize/sequelize/pull/11626)
- docs: describe logging option [#11654](https://github.com/sequelize/sequelize/pull/11654)
- docs(transaction): fix typo [#11659](https://github.com/sequelize/sequelize/pull/11659)
- docs(hooks): add info about belongs-to-many [#11601](https://github.com/sequelize/sequelize/pull/11601)
- docs(associations): fix typo [#11592](https://github.com/sequelize/sequelize/pull/11592)

### 6.0.0-beta.3

- feat: support cls-hooked / tests [#11584](https://github.com/sequelize/sequelize/pull/11584)

### 6.0.0-beta.2

- feat(postgres): change returning option to only return model attributes [#11526](https://github.com/sequelize/sequelize/pull/11526)
- fix(associations): allow binary key for belongs-to-many [#11578](https://github.com/sequelize/sequelize/pull/11578)
- fix(postgres): always replace returning statement for upsertQuery
- fix(model): make .changed() deep aware [#10851](https://github.com/sequelize/sequelize/pull/10851)
- change: use node 10 [#11580](https://github.com/sequelize/sequelize/pull/11580)
