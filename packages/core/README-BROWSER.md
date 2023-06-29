This pull request is a casual attempt at "bunding" Sequelize for in-browser usage.

The original issue is:
https://github.com/sequelize/sequelize/issues/16207

## Rationale

Sequelize supports `sql.js` database (via [`sql.js-as-sqlite3`](https://www.npmjs.com/package/sql.js-as-sqlite3) module) which runs in a web browser, meaning that Sequelize could run in a web browser too.

```js
import Sequelize from 'sequelize'
import sqlJsAsSqlite3 from 'sql.js-as-sqlite3'

const sequelize = new Sequelize('sqlite://:memory:', {
  dialectModule: sqlJsAsSqlite3
})
````

## Demo

Online:
https://catamphetamine.github.io/sequelize

Locally:
* Build the browser "bundle" via `npm run build-browser`.
* Open `build-browser/index.html` file in a web browser and click "Run the Example" button.

## Build

The following pre-built bundles already can be used to run Sequelize in a web browser:

```html
<!-- There's also a non-minified version for potential debugging: -->
<!-- <script src="https://catamphetamine.github.io/sequelize/sequelize.js"/> -->
<script src="https://catamphetamine.github.io/sequelize/sequelize.min.js"/>
<script src="https://unpkg.com/sql.js-as-sqlite3@0.1.x/bundle/sql.js-as-sqlite3.min.js"></script>

<script>
  const sequelize = new Sequelize('sqlite://:memory:', { dialectModule: sqlJsAsSqlite3 });

  const User = sequelize.define('user', {
    username: Sequelize.STRING,
    birthday: Sequelize.DATE
  })

  await sequelize.sync()

  // Create and fetch a record.

  let user = await User.create({
    username: 'jane',
    birthday: Date.UTC(1980, 6, 1)
  })

  user = user.get({ plain: true })
  delete user.createdAt
  delete user.updatedAt

  alert(user)

  // Clear the database.
  await User.truncate()
</script>
```

## Development

* Clone the repo: https://github.com/catamphetamine/sequelize

* Go to the repo's folder: `cd ...`.

* Switch to the [`feature/browser`](https://github.com/catamphetamine/sequelize/tree/feature/browser) branch of the repo: `git checkout feature/browser`.

* Run `yarn` in the root folder. It installs the packages.

* Go to the `core` package folder: `cd packages/core`.

* Run `npm run build` there. It creates a server-side build of Sequelize (core) and outputs it in the `lib` folder. The "entry" file is `lib/index.js`.

* Run `npm run build-browser` there. It creates a client-side "bundle" of Sequelize (core) from the server-side build in the `lib` folder, and outputs the results in the `build-browser` folder. The files are `build-browser/sequelize.js` and `build-browser/sequelize.min.js`.

* The [`esbuild`](https://esbuild.github.io/) config that is used for the build script can be found at `packages/core/build-browser/esbuild.mjs`. It "shims" some of the server-side packages by replacing them with plaform-agnostic (pure-javascript) ones so that the code could run in a web browser environment.

## Notes

* Not required, but someone could do that, if they preferred: In `packages/core/src/sequelize.js` file, in `switch (this.getDialect())` statement, there're `require()`s of all supported "dialects". Since the only web-browser-supported database currently is SQLite (via `sql.js`), all the other "dialect" `require()`s could be removed from there. Presumably that would slightly reduce the overall bundle size, although I'd guess that the effect would be negligible. It works as-is anyway.

## Limitations

* The only supported databases at the moment are:
  * SQLite (with `sql.js-as-sqlite3` module as a `dialectModule` parameter value).

```js
import Sequelize from 'sequelize'
import sqlJsAsSqlite3 from 'sql.js-as-sqlite3'

const sequelize = new Sequelize('sqlite://:memory:', {
  dialectModule: sqlJsAsSqlite3
})
```

* When creating ["managed" transactions](https://sequelize.org/docs/v6/other-topics/transactions/) via `sequelize.transaction(options, callback)`, it doesn't enable the "CLS" (Continuation Local Storage) feature for automatically selecting that transaction for any queries dispatched from the `callback`. The workaround is to pass the `transaction` parameter explicitly to any queries dispatched from such `callback`.

```js
await sequelize.transaction(async t => {
  const user = await User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, { transaction: t });
});
```

## Tests

"Shims" could be tested by running `yarn run test-browser-shims` script in the `core` package directory.

## Miscellaneous

* To search for the places in the code where Node.js-specific packages are `require()`d, use "Find in Files" features of an IDE while searching for `require(` string in `packages/core/src` folder. If the IDE supports searching for a regular expression, search for `require(['"][^\.]` instead.

* To search for the places in the code where Node.js-specific packages are `import`ed, use "Find in Files" features of an IDE while searching for ` from ` string in `packages/core/src` folder. If the IDE supports searching for a regular expression, search for ` from ['"][^\.]` instead.