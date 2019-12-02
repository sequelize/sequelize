# Upgrade to v6

Sequelize v6 is the next major release after v5

## Breaking Changes

### Support for Node 10 and up

Sequelize v6 will only support Node 10 and up [#10821](https://github.com/sequelize/sequelize/issues/10821)

### CLS

You should now use [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked) package for CLS support.

```js
  const cls = require('cls-hooked');
  const namespace = cls.createNamespace('....');
  const Sequelize = require('sequelize');

  Sequelize.useCLS(namespace);
```

Bluebird [now supports](https://github.com/petkaantonov/bluebird/issues/1403) `async_hooks`. This configuration will automatically be enabled when invoking `Sequelize.useCLS`. Thus all promises should maintain CLS context without `cls-bluebird` patching.

### Model

**`options.returning`**

Option `returning: true` will no longer return attributes that are not defined in the model. Old behavior can be restored by using `returning: ['*']`

**`Model.changed()`**

This method now tests for equality with `_.isEqual` and is now deep aware. Modifying nested value for JSON object won't mark them as changed, because it is still the same object.

```js
  const instance = await MyModel.findOne();

  instance.myJsonField.a = 1;
  console.log(instance.changed()) => false

  await instance.save(); // this will not save anything

  instance.changed('myJsonField', true);
  console.log(instance.changed()) => ['myJsonField']

  await instance.save(); // will save
```

## Changelog

### 6.0.0-beta.3

- feat: support cls-hooked / tests [#11584](https://github.com/sequelize/sequelize/pull/11584)

### 6.0.0-beta.2

- feat(postgres): change returning option to only return model attributes [#11526](https://github.com/sequelize/sequelize/pull/11526)
- fix(associations): allow binary key for belongs-to-many [#11578](https://github.com/sequelize/sequelize/pull/11578)
- fix(postgres): always replace returning statement for upsertQuery
- fix(model): make .changed() deep aware [#10851](https://github.com/sequelize/sequelize/pull/10851)
- change: use node 10 [#11580](https://github.com/sequelize/sequelize/pull/11580)
