# @sequelize/firebird

> Firebird dialect for [Sequelize v7](https://sequelize.org/), backed by [node-firebird](https://github.com/hgourvest/node-firebird).

---

## Installation (inside the monorepo)

1. Copy this folder to `packages/firebird` inside the Sequelize monorepo.
2. Register the package in the root `lerna.json` (it is auto-discovered via `packages/*`).
3. Add `node-firebird` as a dependency and run:

```powershell
yarn install
yarn build
```

---

## Usage

```ts
import { Sequelize } from '@sequelize/core';
import { FirebirdDialect } from '@sequelize/firebird';

const sequelize = new Sequelize({
  dialect: FirebirdDialect,
  host: 'localhost',
  port: 3050,
  database: 'C:/data/myapp.fdb', // full path on the server
  username: 'SYSDBA',
  password: 'masterkey',
  dialectOptions: {
    charset: 'UTF8',
    blobAsText: true,
  },
  omitNull: true,
});

await sequelize.authenticate();
```

---

## Firebird-specific Quirks Handled

| Standard SQL       | Firebird equivalent                  | Notes                             |
| ------------------ | ------------------------------------ | --------------------------------- |
| `LIMIT n OFFSET m` | `FIRST n SKIP m`                     | Injected after `SELECT`           |
| `AUTOINCREMENT`    | `SEQUENCE` + `BEFORE INSERT TRIGGER` | Created automatically on `sync()` |
| `TRUNCATE TABLE`   | `DELETE FROM`                        | No sequence reset                 |
| `RENAME TABLE`     | ❌ not supported                     | Throws error                      |
| `JSON` column      | `BLOB SUB_TYPE TEXT`                 | No JSON operators                 |
| `TINYINT`          | `SMALLINT`                           | No 8-bit int in Firebird          |
| `UUID`             | `CHAR(36)`                           | No native UUID type               |
| `BOOLEAN`          | `BOOLEAN`                            | Requires Firebird 3.0+            |
| Identifiers        | Double-quoted `"name"`               | Case-sensitive when quoted        |
| Scalar `SELECT`    | `FROM RDB$DATABASE`                  | Firebird's "dual" table           |

---

## Data Type Mapping

| Sequelize                | Firebird SQL         | Notes                  |
| ------------------------ | -------------------- | ---------------------- |
| `DataTypes.STRING(n)`    | `VARCHAR(n)`         |                        |
| `DataTypes.TEXT`         | `BLOB SUB_TYPE TEXT` |                        |
| `DataTypes.CHAR(n)`      | `CHAR(n)`            |                        |
| `DataTypes.INTEGER`      | `INTEGER`            |                        |
| `DataTypes.BIGINT`       | `BIGINT`             |                        |
| `DataTypes.SMALLINT`     | `SMALLINT`           |                        |
| `DataTypes.TINYINT`      | `SMALLINT`           | No TINYINT in Firebird |
| `DataTypes.FLOAT`        | `FLOAT`              |                        |
| `DataTypes.DOUBLE`       | `DOUBLE PRECISION`   |                        |
| `DataTypes.DECIMAL(p,s)` | `DECIMAL(p,s)`       |                        |
| `DataTypes.BOOLEAN`      | `BOOLEAN`            | Firebird 3+            |
| `DataTypes.DATE`         | `TIMESTAMP`          |                        |
| `DataTypes.DATEONLY`     | `DATE`               |                        |
| `DataTypes.TIME`         | `TIME`               |                        |
| `DataTypes.UUID`         | `CHAR(36)`           |                        |
| `DataTypes.BLOB`         | `BLOB`               |                        |
| `DataTypes.JSON`         | `BLOB SUB_TYPE TEXT` | No JSON operators      |
