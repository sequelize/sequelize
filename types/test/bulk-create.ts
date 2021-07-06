import { DataTypes, Sequelize } from 'sequelize';

const sequelize = new Sequelize('mysql://user:user@localhost:3306/mydb');

const User = sequelize.define('User', {
  username: DataTypes.STRING,
  secretValue: {
    type: DataTypes.STRING,
    field: 'secret_value'
  },
  data: DataTypes.STRING,
  intVal: DataTypes.INTEGER,
  theDate: DataTypes.DATE,
  aBool: DataTypes.BOOLEAN,
  uniqueName: { type: DataTypes.STRING, unique: true }
});

const data = [
  { uniqueName: 'Peter', secretValue: '12', intVal: 12 },
  { uniqueName: 'Paul', secretValue: '23', intVal: 23 }
];

User.bulkCreate(data, {
  fields: ['uniqueName', 'secretValue', 'intVal'],
  updateOnDuplicate: ['secretValue', 'intVal']
});

const new_data = [
  { uniqueName: 'Peter', secretValue: '43', intVal: 43 },
  { uniqueName: 'Paul', secretValue: '24', intVal: 24 },
  { uniqueName: 'Michael', secretValue: '26', intVal: 26 }
];

User.bulkCreate(new_data, {
  fields: ['uniqueName', 'secretValue', 'intVal'],
  updateOnDuplicate: ['secretValue', 'intVal'],
  conflictWhere: {
    intVal: 23
  }
});
