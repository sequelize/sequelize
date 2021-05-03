const Sequelize = require('./');
var sequelize = new Sequelize('sample', 'newton', 'A2m8test', {
  host: 'waldevdbclnxtst06.dev.rocketsoftware.com',
  port: 60000,
  protocol:'TCPIP',
  dialect: 'db2',
  debug: true,

  pool: {
    max: 5,
    min: 0,
    idle: 10000
  }
});
output();


/*
// Or you can simply use a connection uri
var sequelize = new Sequelize('db2://db2admin:Admin123@waldevdbcwdev33.dev.rocketsoftware.com:50000/sample');
var sequelize = new Sequelize('database=sample;hostname=waldevdbcwdev33.dev.rocketsoftware.com;port=50000;uid=db2admin;pwd=Admin123');
*/
async function output() {
await sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

const User = sequelize.define('user1', {
  firstName: {
    type: Sequelize.STRING
  },
  lastName: {
    type: Sequelize.STRING
  }
});

// force: true will drop the table if it already exists
User.sync({force: true}).then(() => {
  // Table created
  return User.create({
    firstName: 'John',
    lastName: 'Hancock'
  });
}).then(() => {
 return User.findAll().then(user1s => {
  console.log(user1s)
 });
});
}
