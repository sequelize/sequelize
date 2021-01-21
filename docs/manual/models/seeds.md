## Seeds

### Creating the first Seed

Suppose we want to insert some data into a few tables by default. If we follow up on previous example we can consider creating a demo user for `User` table.

To manage all data migrations you can use seeders. Seed files are some change in data that can be used to populate database table with sample data or test data.

Let's create a seed file which will add a demo user to our `User` table.

```text
npx sequelize-cli seed:generate --name demo-user
```

This command will create a seed file in `seeders` folder. File name will look something like `XXXXXXXXXXXXXX-demo-user.js`. It follows the same `up / down` semantics as the migration files.

Now we should edit this file to insert demo user to `User` table.

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('Users', [{
      firstName: 'John',
      lastName: 'Doe',
      email: 'example@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Users', null, {});
  }
};
```

## Running Seeds

In last step you have create a seed file. It's still not committed to database. To do that we need to run a simple command.

```text
npx sequelize-cli db:seed:all
```

This will execute that seed file and you will have a demo user inserted into `User` table.

**Note:** _Seeder execution history is not stored anywhere, unlike migrations, which use the `SequelizeMeta` table. If you wish to change this behavior, please read the `Storage` section._

## Undoing Seeds

Seeders can be undone if they are using any storage. There are two commands available for that:

If you wish to undo the most recent seed:

```text
npx sequelize-cli db:seed:undo
```

If you wish to undo a specific seed:

```text
npx sequelize-cli db:seed:undo --seed name-of-seed-as-in-data
```

If you wish to undo all seeds:

```text
npx sequelize-cli db:seed:undo:all
```

## Seed Storage

By default the CLI will not save any seed that is executed. If you choose to change this behavior (!), you can use `seederStorage` in the configuration file to change the storage type. If you choose `json`, you can specify the path of the file using `seederStoragePath` or the CLI will write to the file `sequelize-data.json`. If you want to keep the information in the database, using `sequelize`, you can specify the table name using `seederStorageTableName`, or it will default to `SequelizeData`.

```json
{
  "development": {
    "username": "root",
    "password": null,
    "database": "database_development",
    "host": "127.0.0.1",
    "dialect": "mysql",
    // Use a different storage. Default: none
    "seederStorage": "json",
    // Use a different file name. Default: sequelize-data.json
    "seederStoragePath": "sequelizeData.json",
    // Use a different table name. Default: SequelizeData
    "seederStorageTableName": "sequelize_data"
  }
}
```
