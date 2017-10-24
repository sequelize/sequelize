# Upgrade to V4

Sequelize V4 is a major release and it introduces new features and breaking changes. Majority of sequelize codebase has been refactored to use ES2015 features. The following guide lists some of the changes to upgrade from v3 to v4. See the [Changelog](https://github.com/sequelize/sequelize/blob/b49f936e9aa316cf4a13bade76585acf4d5d8b04/changelog.md) for full list of changes.

### Breaking Changes

- Node version: To use new ES2015 features, we now require at least Node 4. From now on, we will support all current LTS versions of Node.
- The counter cache plugin, and consequently the counterCache option for associations has been removed. The same behaviour can be achieved using `afterCreate` and `afterDelete` hooks.
- Removed MariaDB dialect. This was just a thin wrapper around MySQL, so using `dialect: 'mysql'` instead should work with no further changes
- Removed default `REPEATABLE_READ` transaction isolation. The isolation level now defaults to that of the database. Explicitly pass the required isolation level when initiating the transaction.
- Removed support for `pool: false`. To use a single connection, set `pool.max` to 1.
- (MySQL) BIGINT now gets converted to string when number is too big
- Removed support for referencesKey, use a references object
  ```js
  references: {
      key: '',
      model: ''
  }
  ```
- `classMethods` and `instanceMethods` are removed.

  Previous:
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

  New:

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
- `Model.Instance` and `instance.Model` are removed. To access the Model from an instance, simply use [`instance.constructor`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/constructor). The Instance class (`Model.Instance`) is now the Model itself.
- Sequelize now uses an independent copy of bluebird library.

    - Promises returned by sequelize are now instances of `Sequelize.Promise` instead of global bluebird `Promise`.
    - The CLS patch does not affect global bluebird promise. Transaction will not automatically get passed to methods when used with `Promise.all` and other bluebird methods. Explicitly patch your bluebird instance to get CLS to work with bluebird methods.

      ```bash
      $ npm install --save cls-bluebird
      ```

      ```js
      const Promise = require('bluebird');
      const Sequelize = require('sequelize');
      const cls = require('continuation-local-storage');
      const ns = cls.createNamespace('transaction-namespace');
      const clsBluebird = require('cls-bluebird');
      clsBluebird(ns, Promise);
      Sequelize.useCLS(ns);
      ```
- `Sequelize.Validator` is now an independent copy of `validator` library
- `DataTypes.DECIMAL` returns string for MySQL and Postgres.
- `DataTypes.DATE` now uses `DATETIMEOFFSET` instead of `DATETIME2` sql datatype in case of MSSQL to record timezone. To migrate existing `DATETIME2` columns into `DATETIMEOFFSET`, see [#7201](https://github.com/sequelize/sequelize/pull/7201#issuecomment-278899803).
- `options.order` now only accepts values with type of array or Sequelize method. Support for string values (ie `{order: 'name DESC'}`) has been deprecated.
- With `BelongsToMany` relationships `add/set/create` setters now set through attributes by passing them as `options.through` (previously second argument was used as through attributes, now it's considered options with `through` being a sub option)

  Previous:
  ```js
  user.addProject(project, { status: 'started' })
  ```

  New:
  ```js
  user.addProject(project, { through: { status: 'started' }})
  ```

- `DATEONLY` now returns string in `YYYY-MM-DD` format rather than `Date` type
- `Model.validate` instance method now runs validation hooks by default. Previously you needed to pass `{ hooks: true }`. You can override this behavior by passing `{ hooks: false }`
- The resulting promise from the `Model.validate` instance method will be rejected when validation fails. It will fulfill when validation succeeds.
- Raw options for where, order and group like `where: { $raw: '..', order: [{ raw: '..' }], group: [{ raw: '..' }] }` have been removed to prevent SQL injection attacks.
- `Sequelize.Utils` is not longer part of the public API, use it at your own risk
- `Hooks` should return Promises now. Callbacks are deprecated.

### New features
- Initial version of `sequelize.sync({ alter: true })` has been added and uses `ALTER TABLE` commands to sync tables. [Migrations](http://docs.sequelizejs.com/manual/tutorial/migrations.html) are still preferred and should be used in production.
- Adding and removing database contraints are now supported. Existing primary, foreignKey and other contraints can now be added/removed using migrations - [See more](http://docs.sequelizejs.com/manual/tutorial/migrations.html#addconstraint-tablename-attributes-options-).
- Instances (database rows) are now instances of the model, instead of being an instance of a  separate class. This means you can replace `User.build()` with `new User()` and `sequelize.define(attributes, options)` with
  ```js
  class User extends Sequelize.Model {}
  User.init(attributes, options)
  ```
  You can then define custom methods, class methods and getters/setter directly in the class.
  This also enables more usage patterns, for example with [decorators](https://www.npmjs.com/package/sequelize-decorators).
- Added `DEBUG` support. You can now use `DEBUG=sequelize* node app.js` to enable logging for all sequelize operations. To filter logged queries, use `DEBUG=sequelize:sql:mssql sequelize:connection*` to log generated SQL queries, connection info etc.
- `JSON` datatype support has been added for `SQLite`
- `UPSERT` is now supported on `MSSQL` using `MERGE` statement.
- Transactions are now fully supported on `MSSQL`.
- Filtered indexes are now supported on `MSSQL` dialect.
  ```js
  queryInterface.addIndex(
    'Person',
    ['firstname', 'lastname'],
    {
      where: {
        lastname: {
          $ne: null
        }
      }
    }
  )
  ```
