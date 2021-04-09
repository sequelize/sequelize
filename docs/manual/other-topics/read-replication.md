# Read Replication

Sequelize supports [read replication](https://en.wikipedia.org/wiki/Replication_%28computing%29#Database_replication), i.e. having multiple servers that you can connect to when you want to do a SELECT query. When you do read replication, you specify one or more servers to act as read replicas, and one server to act as the main writer, which handles all writes and updates and propagates them to the replicas (note that the actual replication process is **not** handled by Sequelize, but should be set up by database backend).

```js
const sequelize = new Sequelize('database', null, null, {
  dialect: 'mysql',
  port: 3306,
  replication: {
    read: [
      { host: '8.8.8.8', username: 'read-1-username', password: process.env.READ_DB_1_PW },
      { host: '9.9.9.9', username: 'read-2-username', password: process.env.READ_DB_2_PW }
    ],
    write: { host: '1.1.1.1', username: 'write-username', password: process.env.WRITE_DB_PW }
  },
  pool: { // If you want to override the options used for the read/write pool you can do so here
    max: 20,
    idle: 30000
  },
})
```

If you have any general settings that apply to all replicas you do not need to provide them for each instance. In the code above, database name and port is propagated to all replicas. The same will happen for user and password, if you leave them out for any of the replicas. Each replica has the following options:`host`,`port`,`username`,`password`,`database`.

Sequelize uses a pool to manage connections to your replicas. Internally Sequelize will maintain two pools created using `pool` configuration.

If you want to modify these, you can pass pool as an options when instantiating Sequelize, as shown above.

Each `write` or `useMaster: true` query will use write pool. For `SELECT` read pool will be used. Read replica are switched using a basic round robin scheduling.
