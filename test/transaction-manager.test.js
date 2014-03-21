var chai               = require('chai')
  , expect             = chai.expect
  , Support            = require(__dirname + '/support')
  , TransactionManager = require(__dirname + '/../lib/transaction-manager')

describe(Support.getTestDialectTeaser("TransactionManager"), function () {
  beforeEach(function() {
    this.transactionManager = new TransactionManager(this.sequelize)
  })

  describe('getConnectorManager', function() {
    describe('if no uuid is passed', function() {
      it('uses the default connector', function() {
        var connectorManager = this.transactionManager.getConnectorManager()
        expect(connectorManager.config.uuid).to.equal('default')
      })

      it('uses the pooling configuration of sequelize', function() {
        var connectorManager = this.transactionManager.getConnectorManager()
          , self             = this

        if (Support.getTestDialect() !== 'sqlite') {
          expect(this.sequelize.config.pool.maxConnections).to.equal(5)
        }

        Object.keys(this.sequelize.config.pool || {}).forEach(function(key) {
          expect(connectorManager.config.pool[key]).to.equal(self.sequelize.config.pool[key])
        })
      })
    })

    describe('if the passed uuid is not equal to "default"', function() {
      it('uses the non-default connector', function() {
        var connectorManager = this.transactionManager.getConnectorManager('a-uuid')
        expect(connectorManager.config.uuid).to.equal('a-uuid')
      })

      it('creates a new connector manager', function() {
        this.transactionManager.getConnectorManager()
        expect(Object.keys(this.transactionManager.connectorManagers).length).to.equal(1)
        this.transactionManager.getConnectorManager('a-uuid')
        expect(Object.keys(this.transactionManager.connectorManagers).length).to.equal(2)
        this.transactionManager.getConnectorManager('a-uuid')
        expect(Object.keys(this.transactionManager.connectorManagers).length).to.equal(2)
      })

      it('treats the connector managers as singleton', function() {
        var connectorManager1 = this.transactionManager.getConnectorManager('a-uuid')
          , connectorManager2 = this.transactionManager.getConnectorManager('a-uuid')

        expect(connectorManager1).to.equal(connectorManager2)
      })

      it('uses the pooling configuration of sequelize but with disabled replication and forced to one connection', function() {
        var connectorManager = this.transactionManager.getConnectorManager('a-uuid')
          , self             = this

        if (Support.getTestDialect() !== 'sqlite') {
          expect(this.sequelize.config.pool.maxConnections).to.equal(5)
        }

        Object.keys(this.sequelize.config.pool || {}).forEach(function(key) {
          if (['minConnections', 'maxConnections'].indexOf(key) === -1) {
            expect(connectorManager.config.pool[key]).to.equal(self.sequelize.config.pool[key])
          }
        })

        expect(connectorManager.config.pool.minConnections).to.equal(1)
        expect(connectorManager.config.pool.maxConnections).to.equal(1)
      })
    })
  })
})
