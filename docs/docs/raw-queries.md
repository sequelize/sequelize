As there are often use cases in which it is just easier to execute raw / already prepared SQL queries, you can utilize the function `sequelize.query`.

By default the function will return two arguments - a results array, and an object containing metadata (affected rows etc.). Note that since this is a raw query, the metadata (property names etc.) is dialect specific. Some dialects return the metadata "within" the results object (as properties on an array). However, two arguments will always be returned, but for MSSQL and MySQL it will be two references to the same object.

```js
sequelize.query("UPDATE users SET y = 42 WHERE x = 12").spread(function(results, metadata) {
  // Results will be an empty array and metadata will contain the number of affected rows.
})
```

In cases where you don't need to access the metadata you can pass in a query type to tell sequelize how to format the results. For example, for a simple select query you could do: 

```js
sequelize.query("SELECT * FROM `users`", { type: sequelize.QueryTypes.SELECT})
  .then(function(users) {
    // We don't need spread here, since only the results will be returned for select queries
  })
```

Several other query types are available. [Peek into the source for details](https://github.com/sequelize/sequelize/blob/master/lib/query-types.js)

A second, optional, argument is the _callee_, which is a model. If you pass a model the returned data will be instances of that model.

```js
// Callee is the model definition. This allows you to easily map a query to a predefined model
sequelize.query('SELECT * FROM projects', Projects).then(function(projects){
  // Each record will now be a instance of Project
})
```

# Replacements
Replacements in a query can be done in two different ways, either using named parameters (starting with `:`), or unnamed, represented by a `?`. Replacements are passed in the options object.

* If an array is passed, `?` will be replaced in the order that they appear in the array
* If an object is passed, `:key` will be replaced with the keys from that object. If the object contains keys not found in the query or vice verca, an exception will be thrown.

```js
sequelize.query('SELECT * FROM projects WHERE status = ?', 
  { replacements: ['active'], type: sequelize.QueryTypes.SELECT }
).then(function(projects) {
  console.log(projects)
})

sequelize.query('SELECT * FROM projects WHERE status = :status ', 
  { replacements: { status: 'active' }, type: sequelize.QueryTypes.SELECT }
).then(function(projects) {
  console.log(projects)
})
```
