---
name: Bug report
about: Create a bug report to help us improve
title: ""
labels: ""
assignees: ""
---

<!--
If you don't follow the issue template, your issue may be closed.
Please note this is an issue tracker, not a support forum.
For general questions, please use StackOverflow:
https://stackoverflow.com/questions/tagged/sequelize.js
-->

## Issue Creation Checklist

- [ ] I have read the [contribution guidelines](https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.md)

## Bug Description

### SSCCE

<!--
We have a repository dedicated to make it easy for you to create an SSCCE.
https://github.com/sequelize/sequelize-sscce
Please consider using it, everyone wins!
-->

**Here is the link to the SSCCE for this issue:** LINK-HERE <!-- add a link to the SSCCE -->

<!--
Instead of using that repository, you can also clone the Sequelize repository and overwrite the `sscce.js` file in the root folder, run it locally and then provide the code here:
-->

```js
// You can delete this code block if you have included a link to your SSCCE above!
const { createSequelizeInstance } = require("./dev/sscce-helpers");
const { Model, DataTypes } = require(".");

const sequelize = createSequelizeInstance({ benchmark: true });

class User extends Model {}
User.init(
  {
    username: DataTypes.STRING,
    birthday: DataTypes.DATE,
  },
  { sequelize, modelName: "user" }
);

(async () => {
  await sequelize.sync({ force: true });

  const jane = await User.create({
    username: "janedoe",
    birthday: new Date(1980, 6, 20),
  });

  console.log("\nJane:", jane.toJSON());

  await sequelize.close();
})();
```

### What do you expect to happen?

<!-- Explain what behavior you wanted/expected. You may include an output. -->

_I wanted Foo!_

### What is actually happening?

<!-- Show what happened. You can skip this part if you included a link to an SSCCE above. -->

_The output was Bar!_

```
Output here
```

### Additional context

Add any other context and details here.

### Environment

<!---
Please answer the questions below. If you don't, your issue may be closed.

To find the version numbers for the three systems below use the following commands:
- `npm list sequelize` / `yarn list --pattern sequelize` (v6 stable)
- `npm list @sequelize/core` / `yarn list --pattern @sequelize/core` (v7 alpha)
- `node -v`
- `npm list typescript` / `yarn list --pattern typescript` 
- 'Database' is which actual database system you're using. e.g. 'PostgreSQL 14', 'MariaDB 8', etc…
- 'Connector library' is the dependency sequelize requires you to install to interact with a given database type. 
  e.g. 'pg' or 'pg-native' for PostgreSQL, 'mysql2' for MySQL, 'tedious' for SQL Server, etc… (see README for complete list).
--->

- Sequelize version:
- Node.js version:
- If TypeScript related: TypeScript version:
- Database & Version:
- Connector library & Version:

## Would you be willing to resolve this issue by submitting a Pull Request?

<!-- Remember that first contributors are welcome! -->

- [ ] Yes, I have the time and I know how to start.
- [ ] Yes, I have the time but I don't know how to start, I would need guidance.
- [ ] No, I don't have the time, although I believe I could do it if I had the time...
- [ ] No, I don't have the time and I wouldn't even know how to start.
