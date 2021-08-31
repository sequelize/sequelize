# Indexes

Sequelize supports adding indexes to the model definition which will be created on [`sequelize.sync()`](../class/lib/sequelize.js~Sequelize.html#instance-method-sync).

```js
const User = sequelize.define('User', { /* attributes */ }, {
  indexes: [
    // Create a unique index on email
    {
      unique: true,
      fields: ['email']
    },

    // Creates a gin index on data with the jsonb_path_ops operator
    {
      fields: ['data'],
      using: 'gin',
      operator: 'jsonb_path_ops'
    },

    // By default index name will be [table]_[fields]
    // Creates a multi column partial index
    {
      name: 'public_by_author',
      fields: ['author', 'status'],
      where: {
        status: 'public'
      }
    },

    // A BTREE index with an ordered field
    {
      name: 'title_index',
      using: 'BTREE',
      fields: [
        'author',
        {
          attribute: 'title',
          collate: 'en_US',
          order: 'DESC',
          length: 5
        }
      ]
    }
  ]
});
```