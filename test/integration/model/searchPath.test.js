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
var locationId;

describe(Support.getTestDialectTeaser('Model'), function() {
  if (current.dialect.supports.searchPath) {

    describe('SEARCH PATH', function() {
      before(function() {
        this.Company = current.define('company', {
            foo: DataTypes.STRING,
            bar: DataTypes.STRING
          },
          {tableName: "company"});
        this.Location = current.define('location', {
            name: DataTypes.STRING
          },
          {tableName: "locations"});
        this.Company.belongsTo(this.Location,
          {
            foreignKey: 'location_id',
            constraints: false
          });
      });

      beforeEach(function() {
        var Company = this.Company;
        return current.createSchema('schema_one').then(function()
        {
          return current.createSchema('schema_two');
        }).then(function() {
          return Company.sync({force: true, searchPath: SEARCH_PATH_ONE})
            .then(function() {
              return Company.sync({force: true, searchPath: SEARCH_PATH_TWO})
                .then(function() {
                })
                .catch(function(err) {
                  expect(err).to.be.null;
                });
            })
            .catch(function(err) {
              expect(err).to.be.null;
            });
        });
      });

      afterEach(function() {
        return current.dropSchema('schema_one').then(function(){
          return current.dropSchema('schema_two');
        });
      });

      describe('Add data via model.create, retrieve via model.findOne',function() {
        it('should be able to insert data into the table in schema_one using create', function() {
          var Company = this.Company;

          return Company.create({
            foo: 'one',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_ONE}).then(function() {
            return Company.findOne({
              where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('one');
            });
          });
        });

        it('should fail to insert data into schema_two using create', function() {
          var Company = this.Company;

          return Company.create({
            foo: 'test'
          }, {searchPath: SEARCH_PATH_TWO}).then(function() {
          }).catch(function(err) {
            expect(err).to.not.be.null;
          });
        });

        it('should be able to insert data into the table in schema_two using create', function() {
          var Company = this.Company;

          return Company.create({
            foo: 'two',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_TWO}).then(function() {
            return Company.findOne({
              where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('two');
            });
          });
        });

        it('should fail to find schema_one object in schema_two', function() {
          var Company = this.Company;

          return Company.findOne({where: {foo: 'one'}, searchPath: SEARCH_PATH_TWO}).then(function(CompanyObj) {
            expect(CompanyObj).to.be.null;
          });
        });

        it('should fail to find schema_two object in schema_one', function() {
          var Company = this.Company;

          return Company.findOne({where: {foo: 'two'}, searchPath: SEARCH_PATH_ONE}).then(function(CompanyObj) {
            expect(CompanyObj).to.be.null;
          });
        });
      });

      describe('Get shared associated data via include',function() {
        beforeEach(function() {
          var Location = this.Location;

          return Location.sync({force: true, searchPath: 'public'})
            .then(function() {
              return Location.create({name: 'HQ'}).then(function() {
                return Location.findOne({where: {name: 'HQ'}}).then(function(obj) {
                  expect(obj).to.not.be.null;
                  expect(obj.name).to.equal('HQ');
                  locationId = obj.id;
                });
              });
            })
            .catch(function(err) {
              expect(err).to.be.null;
            });
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          var Company = this.Company;
          var Location = this.Location;

          return Company.create({
            foo: 'one',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_ONE}).then(function() {
            return Company.findOne({
              where: {foo: 'one'}, include: [{
                model: Location, as: 'location'
              }], searchPath: SEARCH_PATH_ONE
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('one');
              expect(obj.location).to.not.be.null;
              expect(obj.location.name).to.equal('HQ');
            });
          });
        });


        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          var Company = this.Company;
          var Location = this.Location;

          return Company.create({
            foo: 'two',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_TWO}).then(function() {
            return Company.findOne({
              where: {foo: 'two'}, include: [{
                model: Location, as: 'location'
              }], searchPath: SEARCH_PATH_TWO
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('two');
              expect(obj.location).to.not.be.null;
              expect(obj.location.name).to.equal('HQ');
            });
          });
        });
      });
    });
  }
});
