'use strict';

/* jshint -W030 */
/* jshint -W110 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/support');
const DataTypes = require(__dirname + '/../../lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Replication'), function() {
  if (dialect === 'sqlite') return;

  beforeEach(() => {
    this.sequelize = Support.getSequelizeInstance(null, null, null, {
      replication: {
        write: Support.getConnectionOptions(),
        read: [Support.getConnectionOptions()]
      }
    });

    expect(this.sequelize.connectionManager.pool.write).to.be.ok;
    expect(this.sequelize.connectionManager.pool.read).to.be.ok;

    this.User = this.sequelize.define('User', {
      firstName: {
        type: DataTypes.STRING,
        field: 'first_name'
      }
    });

    return this.User.sync({force: true});
  });

  it('should be able to make a write', () => {
    return this.User.create({
      firstName: Math.random().toString()
    });
  });

  it('should be able to make a read', () => {
    return this.User.findAll();
  });
});
