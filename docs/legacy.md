# Working with legacy tables

While out of the box Sequelize will seem a bit opinionated it's trivial to both legacy and forward proof your application by defining (otherwise generated) table and field names.

## Tables
```js
sequelize.define('user', {

}, {
  tableName: 'users'
});
```

## Fields
```js
sequelize.define('modelName', {
  userId: {
    type: Sequelize.INTEGER,
    field: 'user_id'
  }
});
```

## Primary keys
Sequelize will assume your table has a `id` primary key property by default.

To define your own primary key:

```js
sequelize.define('collection', {
  uid: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true // Automatically gets converted to SERIAL for postgres
  }
});

sequelize.define('collection', {
  uuid: {
    type: Sequelize.UUID,
    primaryKey: true
  }
});
```

And if your model has no primary key at all you can use `Model.removeAttribute('id');`

## Foreign keys
```js
// 1:1
Organization.belongsTo(User, {foreignKey: 'owner_id'});
User.hasOne(Organization, {foreignKey: 'owner_id'});

// 1:M
Project.hasMany(Task, {foreignKey: 'tasks_pk'});
Task.belongsTo(Project, {foreignKey: 'tasks_pk'});

// N:M
User.hasMany(Role, {through: 'user_has_roles', foreignKey: 'user_role_user_id'});
Role.hasMany(User, {through: 'user_has_roles', foreignKey: 'roles_identifier'});
```
