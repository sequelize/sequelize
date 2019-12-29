# Upgrade to V4

Sequelize v4 is the current release and it introduces some breaking changes. Majority of sequelize codebase has been refactored to use ES2015 features. The following guide lists some of the changes to upgrade from v3 to v4.

## Changelog

Full [Changelog](https://github.com/sequelize/sequelize/blob/b49f936e9aa316cf4a13bade76585acf4d5d8b04/changelog.md) for v4 release.

## Breaking Changes

### Node

To use new ES2015 features, Sequelize v4 requires at least Node v4 or above.

### General

* Counter Cache plugin and consequently the ```counterCache``` option for associations has been removed.
* MariaDB dialect now removed. This was just a thin wrapper around MySQL. You can set ``dialect: 'mysql'`` an d Sequelize should be able to work with MariaDB server.
* `Model.Instance` and `instance.Model` are removed. To access the Model from an instance, simply use [`instance.constructor`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/constructor). The Instance class (`Model.Instance`) is now the Model itself.
* Sequelize now uses an independent copy of bluebird library.
* Promises returned by sequelize are now instances of `Sequelize.Promise` instead of global bluebird `Promise`.
* Pooling library was updated to `v3`, now you will need to call `sequelize.close()` to shutdown the pool.

### Config / Options

* Removed support for old connection pooling configuration keys. Instead of

  **Old**
  ```js
    pool: {
      maxIdleTime: 30000,
      minConnections: 20,
      maxConnections: 30
    }
  ```

  **New**
  ```js
    pool: {
      idle: 30000,
      min: 20,
      max: 30
    }
  ```
* Removed support for `pool: false`. To use a single connection, set `pool.max` to 1.
* Removed support for ``referencesKey``, use a references object
  ```js
    references: {
      key: '',
      model: ''
    }
  ```
* Removed `classMethods` and `instanceMethods` options from `sequelize.define`. Sequelize models
are now ES6 classes. You can set class / instance level methods like this

  **Old**

  ```js
  const Model = sequelize.define('Model', {
      ...
  }, {
      classMethods: {
          associate: function (model) {...}
      },
      instanceMethods: {
          someMethod: function () { ...}
      }
  });
  ```

  **New**

  ```js
  const Model = sequelize.define('Model', {
      ...
  });

  // Class Method
  Model.associate = function (models) {
      ...associate the models
  };

  // Instance Method
  Model.prototype.someMethod = function () {..}
  ```

* `options.order` now only accepts values with type of array or Sequelize method. Support for string values (ie `{order: 'name DESC'}`) has been deprecated.
* With `BelongsToMany` relationships `add/set/create` setters now set through attributes by passing them as `options.through` (previously second argument was used as through attributes, now it's considered options with `through` being a sub option)
* Raw options for where, order and group like `where: { $raw: '..', order: [{ raw: '..' }], group: [{ raw: '..' }] }` have been removed to prevent SQL injection attacks.

  **Old**

  ```js
  user.addProject(project, { status: 'started' });
  ```

  **New**

  ```js
  user.addProject(project, { through: { status: 'started' } });
  ```

### Data Types

* (MySQL/Postgres) `BIGINT` now returned as string.
* (MySQL/Postgres) `DECIMAL` and `NEWDECIMAL` types now returned as string.
* (MSSQL) `DataTypes.DATE` now uses `DATETIMEOFFSET` instead of `DATETIME2` sql datatype in case of MSSQL to record timezone. To migrate existing `DATETIME2` columns into `DATETIMEOFFSET`, see [#7201](https://github.com/sequelize/sequelize/pull/7201#issuecomment-278899803).
* `DATEONLY` now returns string in `YYYY-MM-DD` format rather than `Date` type

### Transactions / CLS

* Removed `autocommit: true` default, set this option explicitly to have transactions auto commit.
* Removed default `REPEATABLE_READ` transaction isolation. The isolation level now defaults to that of the database. Explicitly pass the required isolation level when initiating the transaction.
* The CLS patch does not affect global bluebird promise. Transaction will not automatically get passed to methods when used with `Promise.all` and other bluebird methods. Explicitly patch your bluebird instance to get CLS to work with bluebird methods.

    ```bash
    $ npm install --save cls-bluebird
    ```

    ```js
    const Sequelize = require('sequelize');
    const Promise = require('bluebird');
    const clsBluebird = require('cls-bluebird');
    const cls = require('continuation-local-storage');

    const ns = cls.createNamespace('transaction-namespace');
    clsBluebird(ns, Promise);

    Sequelize.useCLS(ns);
    ```

### Raw Queries

* Sequelize now supports bind parameters for all dialects. In v3 `bind` option would fallback to `replacements` if dialect didn't supported binding. This could be a breaking change for MySQL / MSSQL where now queries will actually use bind parameters instead of replacements fallback.

### Others

* `Sequelize.Validator` is now an independent copy of `validator` library.
* `Model.validate` instance method now runs validation hooks by default. Previously you needed to pass `{ hooks: true }`. You can override this behavior by passing `{ hooks: false }`.
* The resulting promise from the `Model.validate` instance method will be rejected when validation fails. It will fulfill when validation succeeds.
* `Sequelize.Utils` is not longer part of the public API, use it at your own risk.
* `Hooks` should return Promises now. Callbacks are deprecated.
* Getters wont run with `instance.get({ raw: true })`, use `instance.get({ plain: true })`
* `required` inside include does not propagate up the include chain.

  To get v3 compatible results you'll need to either set `required` on the containing include.

  **Old**

  ```js
  user.findOne({
    include: {
      model: project,
      include: {
        model: task,
        required: true
      }
    }
  });
  ```

  **New**

  ```js
  User.findOne({
    include: {
      model: Project,
      required: true,
      include: {
        model: Task,
        required: true
      }
    }
  });

  User.findOne({
    include: {
      model: Project,
      required: true,
      include: {
        model: Task,
        where: { type: 'important' } //where cause required to default to true
      }
    }
  });
  ```

  Optionally you can add a `beforeFind` hook to get v3 compatible behavior -

  ```js
  function propagateRequired(modelDescriptor) {
    let include = modelDescriptor.include;

    if (!include) return false;
    if (!Array.isArray(include)) include = [include];

    return include.reduce((isRequired, descriptor) => {
      const hasRequiredChild = propogateRequired(descriptor);
      if ((descriptor.where || hasRequiredChild) && descriptor.required === undefined) {
        descriptor.required = true;
      }
      return descriptor.required || isRequired;
    }, false);
  }

  const sequelize = new Sequelize(..., {
    ...,
    define: {
      hooks: {
        beforeFind: propagateRequired
      }
    }
  });
  ```
