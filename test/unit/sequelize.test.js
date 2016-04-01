'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Sequelize = require(__dirname + '/../../index');

describe('sequelize constructor', function () {
  it('should support database, username, password, options', function () {
    var database = Math.random().toString()
      , username = Math.random().toString()
      , password = Math.random().toString()
      , host = Math.random().toString()
      , port = Math.random().toString();

    var sequelize = new Sequelize(database, username, password, {
      host: host,
      port: port
    });

    expect(sequelize.config.database).to.equal(database);
    expect(sequelize.config.username).to.equal(username);
    expect(sequelize.config.password).to.equal(password);
    expect(sequelize.config.host).to.equal(host);
    expect(sequelize.config.port).to.equal(port);
  });

  it('should support connection uri, options', function () {
    var dialect = 'postgres'
      , database = Math.ceil(Math.random() * 9999).toString()
      , username = Math.ceil(Math.random() * 9999).toString()
      , password = Math.ceil(Math.random() * 9999).toString()
      , host = Math.ceil(Math.random() * 9999).toString()
      , port = Math.ceil(Math.random() * 9999).toString();

    var uri = dialect + '://' + username + ':' + password + '@' + host + ':' + port + '/' + database;

    var sequelize = new Sequelize(uri);

    expect(sequelize.config.database).to.equal(database);
    expect(sequelize.config.username).to.equal(username);
    expect(sequelize.config.password).to.equal(password);
    expect(sequelize.config.host).to.equal(host);
    expect(sequelize.config.port).to.equal(port);
  });

  it('should support options', function () {
    var database = Math.random().toString()
      , username = Math.random().toString()
      , password = Math.random().toString()
      , host = Math.random().toString()
      , port = Math.random().toString();

    var sequelize = new Sequelize({
      host: host,
      port: port,
      database: database,
      username: username,
      password: password
    });

    expect(sequelize.config.database).to.equal(database);
    expect(sequelize.config.username).to.equal(username);
    expect(sequelize.config.password).to.equal(password);
    expect(sequelize.config.host).to.equal(host);
    expect(sequelize.config.port).to.equal(port);
  });
});