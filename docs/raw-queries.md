# Raw queries

As there are often use cases in which it is just easier to execute raw / already prepared SQL queries, you can utilize the function `sequelize.query`.

By default the function will return two arguments - a results array, and an object containing metadata (affected rows etc.). Note that since this is a raw query, the metadata (property names etc.) is dialect specific. Some dialects return the metadata "within" the results object (as properties on an array). However, two arguments will always be returned, but for MSSQL and MySQL it will be two references to the same object.

```js
sequelize.query("UPDATE users SET y = 42 WHERE x = 12").spread((results, metadata) => {
  // Results will be an empty array and metadata will contain the number of affected rows.
})
```

In cases where you don't need to access the metadata you can pass in a query type to tell sequelize how to format the results. For example, for a simple select query you could do:

```js
sequelize.query("SELECT * FROM `users`", { type: sequelize.QueryTypes.SELECT})
  .then(users => {
    // We don't need spread here, since only the results will be returned for select queries
  })
```

Several other query types are available. [Peek into the source for details](https://github.com/sequelize/sequelize/blob/master/lib/query-types.js)

A second option is the model. If you pass a model the returned data will be instances of that model.

```js
// Callee is the model definition. This allows you to easily map a query to a predefined model
sequelize
  .query('SELECT * FROM projects', {
    model: Projects,
    mapToModel: true // pass true here if you have any mapped fields
  })
  .then(projects => {
    // Each record will now be an instance of Project
  })
```

## Replacements
Replacements in a query can be done in two different ways, either using named parameters (starting with `:`), or unnamed, represented by a `?`. Replacements are passed in the options object.

* If an array is passed, `?` will be replaced in the order that they appear in the array
* If an object is passed, `:key` will be replaced with the keys from that object. If the object contains keys not found in the query or vice versa, an exception will be thrown.

```js
sequelize.query('SELECT * FROM projects WHERE status = ?',
  { replacements: ['active'], type: sequelize.QueryTypes.SELECT }
).then(projects => {
  console.log(projects)
})

sequelize.query('SELECT * FROM projects WHERE status = :status ',
  { replacements: { status: 'active' }, type: sequelize.QueryTypes.SELECT }
).then(projects => {
  console.log(projects)
})
```

Array replacements will automatically be handled, the following query searches for projects where the status matches an array of values.

```js
sequelize.query('SELECT * FROM projects WHERE status IN(:status) ',
  { replacements: { status: ['active', 'inactive'] }, type: sequelize.QueryTypes.SELECT }
).then(projects => {
  console.log(projects)
})
```

To use the wildcard operator %, append it to your replacement. The following query matches users with names that start with 'ben'.

```js
sequelize.query('SELECT * FROM users WHERE name LIKE :search_name ',
  { replacements: { search_name: 'ben%'  }, type: sequelize.QueryTypes.SELECT }
).then(projects => {
  console.log(projects)
})
```

## Bind Parameter
Bind parameters are like replacements. Except replacements are escaped and inserted into the query by sequelize before the query is sent to the database, while bind parameters are sent to the database outside the SQL query text. A query can have either bind parameters or replacements. Bind parameters are referred to by either $1, $2, ... (numeric) or $key (alpha-numeric). This is independent of the dialect.

* If an array is passed, `$1` is bound to the 1st element in the array (`bind[0]`)
* If an object is passed, `$key` is bound to `object['key']`. Each key must begin with a non-numeric char. `$1` is not a valid key, even if `object['1']` exists.
* In either case `$$` can be used to escape a literal `$` sign.

The array or object must contain all bound values or Sequelize will throw an exception. This applies even to cases in which the database may ignore the bound parameter.

The database may add further restrictions to this. Bind parameters cannot be SQL keywords, nor table or column names. They are also ignored in quoted text or data. In PostgreSQL it may also be needed to typecast them, if the type cannot be inferred from the context `$1::varchar`.

```js
sequelize.query('SELECT *, "text with literal $$1 and literal $$status" as t FROM projects WHERE status = $1',
  { bind: ['active'], type: sequelize.QueryTypes.SELECT }
).then(projects => {
  console.log(projects)
})

sequelize.query('SELECT *, "text with literal $$1 and literal $$status" as t FROM projects WHERE status = $status',
  { bind: { status: 'active' }, type: sequelize.QueryTypes.SELECT }
).then(projects => {
  console.log(projects)
})
```

