# Working with Legacy Tables

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
    type: DataTypes.INTEGER,
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
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  }
}, { sequelize });

class Collection extends Model {}
Collection.init({
  uuid: {
    type: DataTypes.UUID,
    primaryKey: true
  }
}, { sequelize });
```

And if your model has no primary key at all you can use `Model.removeAttribute('id');`.  Instances without primary keys, retrieved using `findOne()`, store the exact query criteria in the model class: once many instances are queried simultaneously, doing instance.save() on any of the instances, will always update the last retrieved instance.  The mitigation is to use `instance.update()` and provide there the search criteria.  [#13819](https://github.com/sequelize/sequelize/pull/13819) proposes a fix, storing the query per instance.

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
