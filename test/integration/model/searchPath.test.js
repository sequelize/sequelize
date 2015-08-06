'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');
var SEARCH_PATH_ONE = 'schema_one,public';
var SEARCH_PATH_TWO = 'schema_two,public';
var current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  if (current.dialect.supports.searchPath) {

    describe('SEARCH PATH', function() {
      before(function() {
        current.createSchema('schema_one');
        current.createSchema('schema_two');
        this.Dummy = current.define('dummy', {
            foo: DataTypes.STRING,
            bar: DataTypes.STRING
          },
          {tableName: "dummy"});
      });

      it('should create a table in schema_one', function() {
        var Dummy = this.Dummy;
        return Dummy.sync({force: true, searchPath: SEARCH_PATH_ONE})
          .then(function() {
          })
          .catch(function(err) {
            expect(err).to.be.null;
          });
      });

      it('should be able to insert data into the table in schema_one using create', function() {
        var Dummy = this.Dummy;

        return Dummy.create({
          foo: 'one'
        }, {searchPath: SEARCH_PATH_ONE}).then(function() {
          return Dummy.findOne({where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE}).then(function(dummyObj) {
            expect(dummyObj).to.not.be.null;
            expect(dummyObj.foo).to.equal('one');
          });
        });
      });

      it('should fail to insert data into schema_two using create', function() {
        var Dummy = this.Dummy;

        return Dummy.create({
          foo: 'test'
        }, {searchPath: SEARCH_PATH_TWO}).then(function() {
        }).catch(function(err) {
          expect(err).to.not.be.null;
        });
      });

      it('should create a table in schema_two', function() {
        var Dummy = this.Dummy;
        return Dummy.sync({force: true, searchPath: SEARCH_PATH_TWO})
          .then(function() {
          })
          .catch(function(err) {
            expect(err).to.be.null;
          });
      });

      it('should be able to insert data into the table in schema_two using create', function() {
        var Dummy = this.Dummy;

        return Dummy.create({
          foo: 'two'
        }, {searchPath: SEARCH_PATH_TWO}).then(function() {
          return Dummy.findOne({where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO}).then(function(dummyObj) {
            expect(dummyObj).to.not.be.null;
            expect(dummyObj.foo).to.equal('two');
          });
        });
      });

      it('should fail to find schema_one object in schema_two', function() {
        var Dummy = this.Dummy;

        return Dummy.findOne({where: {foo: 'one'}, searchPath: SEARCH_PATH_TWO}).then(function(dummyObj) {
          expect(dummyObj).to.be.null;
        });
      });

      it('should fail to find schema_two object in schema_one', function() {
        var Dummy = this.Dummy;

        return Dummy.findOne({where: {foo: 'two'}, searchPath: SEARCH_PATH_ONE}).then(function(dummyObj) {
          expect(dummyObj).to.be.null;
        });
      });

      after(function() {
        current.dropSchema('schema_one');
        current.dropSchema('schema_two');
      });
    });
  }
});
