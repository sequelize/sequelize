# Upgrade to v6

Sequelize v6 is the next major release after v5. Below is a list of breaking changes to help you upgrade.

## Breaking Changes

### Support for Node 10 and up

Sequelize v6 will only support Node 10 and up [#10821](https://github.com/sequelize/sequelize/issues/10821).

### CLS

You should now use [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked) package for CLS support.

```js
  const cls = require('cls-hooked');
  const namespace = cls.createNamespace('....');
  const Sequelize = require('sequelize');

  Sequelize.useCLS(namespace);
```

[Bluebird now supports `async_hooks`](https://github.com/petkaantonov/bluebird/issues/1403). This configuration will automatically be enabled when invoking `Sequelize.useCLS`. This way, using [`cls-bluebird`](https://www.npmjs.com/package/cls-bluebird) is no longer necessary.

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

  instance.changed('myJsonField', true);
  console.log(instance.changed()); // ['myJsonField']

  await instance.save(); // will save
```

## Changelog

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
