# Working with legacy tables

While out of the box Sequelize will seem a bit opinionated it's easy to work legacy tables and forward proof your application by defining (otherwise generated) table and field names.

## Tables

```js
class User extends Model {}
User.init({
  // ...
}, {
  modelName: 'user',
  tableName: 'users',
  sequelize,
});
```

## Fields

```js
class MyModel extends Model {}
MyModel.init({
  userId: {
    type: Sequelize.INTEGER,
    field: 'user_id'
  }
}, { sequelize });
```

## Primary keys

Sequelize will assume your table has a `id` primary key property by default.

To define your own primary key:

```js
class Collection extends Model {}
Collection.init({
  uid: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  }
}, { sequelize });

class Collection extends Model {}
Collection.init({
  uuid: {
    type: Sequelize.UUID,
    primaryKey: true
  }
}, { sequelize });
```

And if your model has no primary key at all you can use `Model.removeAttribute('id');`

## Foreign keys

```js
// 1:1
Organization.belongsTo(User, { foreignKey: 'owner_id' });
User.hasOne(Organization, { foreignKey: 'owner_id' });

// 1:M
Project.hasMany(Task, { foreignKey: 'tasks_pk' });
Task.belongsTo(Project, { foreignKey: 'tasks_pk' });

// N:M
User.belongsToMany(Role, { through: 'user_has_roles', foreignKey: 'user_role_user_id' });
Role.belongsToMany(User, { through: 'user_has_roles', foreignKey: 'roles_identifier' });
```
