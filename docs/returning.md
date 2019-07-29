# Returning

## bulkInsertQuery

Returning allows you to define what is returned in the returning clause of your SQL query for the bulkInsertQuery.

By default the returning value is set to false. However,
```js
sequelize.query("UPDATE users SET y = 42 WHERE x = 12").spread((results, metadata) => {
  // Results will be an empty array and metadata will contain the number of affected rows.
})
```