'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , Sequelize = require('../../../../index')
  , Promise = Sequelize.Promise
  , _ = require('lodash');


if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] QueryInterface', function () {
    beforeEach(function () {
      this.sequelize.options.quoteIdenifiers = true;
      this.queryInterface = this.sequelize.getQueryInterface();
    });

    describe('createFunction', function () {

      beforeEach( function () {
        //make sure we don't have a pre-existing function called create_job
        //this is needed to cover the edge case of afterEach not getting called because of an unexpected issue or stopage with the 
        //test suite causing a failure of afterEach's cleanup to be called.
        return this.queryInterface.dropFunction('create_job',[{type:'varchar',name:'test'}])
        //suppress errors here. if create_job doesn't exist thats ok.
        .catch( err => {});
      });

      after( function () {
        //cleanup
        return this.queryInterface.dropFunction('create_job',[{type:'varchar',name:'test'}])
        //suppress errors here. if create_job doesn't exist thats ok.
        .catch( err => {});
      });

      it('creates a stored procedure', function () {
        var body = 'return test;';
        var options = {};

        //make our call to create a function
        return this.queryInterface.createFunction('create_job', [{type:'varchar',name:'test'}], 'varchar', 'plpgsql', body, options)
        //validate
        .then( () =>  {
          return this.sequelize.query('select create_job(\'test\');', { type: this.sequelize.QueryTypes.SELECT });
        })
        .then( res => {
          return expect(res[0].create_job).to.be.eql('test');
        });
      });

      it('treats options as optional', function () {
        var body = 'return test;';

        //run with null options parameter
        return this.queryInterface.createFunction('create_job', [{type:'varchar',name:'test'}], 'varchar', 'plpgsql', body, null)
        //validate
        .then( () => { 
          return this.sequelize.query('select create_job(\'test\');', { type: this.sequelize.QueryTypes.SELECT });
        })
        .then( res => {
          return expect(res[0].create_job).to.be.eql('test');
        });
      });

      it('produces an error when missing expected parameters', function () {
        var body = 'return 1;';
        var options = {};
        
        return Promise.all([
          //requires functionName  
          expect( () => {
            return this.queryInterface.createFunction(null, [{name:'test'}], 'integer', 'plpgsql', body, options);
          }).to.throw(/createFunction missing some parameters. Did you pass functionName, returnType, language and body/)
        
          //requires Parameters array
          ,expect( () => {
            return this.queryInterface.createFunction('create_job',null, 'integer', 'plpgsql', body, options);
          }).to.throw(/function parameters array required/)
          
          //requires returnType
          ,expect( () => {
            return this.queryInterface.createFunction('create_job', [{type:'varchar',name:'test'}], null, 'plpgsql', body, options);
          }).to.throw(/createFunction missing some parameters. Did you pass functionName, returnType, language and body/)
        
          //requires type in parameter array
          ,expect( () => {
            return this.queryInterface.createFunction('create_job', [{name:'test'}], 'integer', 'plpgsql', body, options);
          }).to.throw(/function or trigger used with a parameter without any type/)
          
          //requires language
          ,expect( () => {
            return this.queryInterface.createFunction('create_job', [{type:'varchar',name:'test'}], 'varchar', null, body, options);
          }).to.throw(/createFunction missing some parameters. Did you pass functionName, returnType, language and body/)

          //requires body
          ,expect( () => {
            return this.queryInterface.createFunction('create_job', [{type:'varchar',name:'test'}], 'varchar', 'plpgsql', null, options);
          }).to.throw(/createFunction missing some parameters. Did you pass functionName, returnType, language and body/)
        ]);
      });
    });

    describe('dropFunction',function () {
      beforeEach( function () {
        var body = 'return test;';
        var options = {};

        //make sure we have a droptest function in place.
        return this.queryInterface.createFunction('droptest', [{type:'varchar',name:'test'}], 'varchar', 'plpgsql', body, options)
        //suppress errors.. this could fail if the function is already there.. thats ok. 
        .catch( function (err) { });
      });

      it('can drop a function', function () {
        //call drop function
        return expect(this.queryInterface.dropFunction('droptest',[{type:'varchar',name:'test'}])
        //now call the function we attempted to drop.. if dropFunction worked as expect it should produce an error.
        .then( () => {
          // call the function we attempted to drop.. if it is still there then throw an error informing that the expected behavior is not met. 
          return this.sequelize.query('select droptest(\'test\');', { type: this.sequelize.QueryTypes.SELECT });  
        }))
        //test that we did get the expected error indicating that droptest was properly removed.
        .to.be.rejectedWith(/.*function droptest.* does not exist/);
      });

      it('produces an error when missing expected parameters', function () {
        return Promise.all([
          expect( () => {
            return this.queryInterface.dropFunction(); 
          }).to.throw(/.*requires functionName/)
          ,
          expect( () => {
            return this.queryInterface.dropFunction('droptest'); 
          }).to.throw(/.*function parameters array required/)
          ,
          expect( () => { 
            return this.queryInterface.dropFunction('droptest', [{name:'test'}]);
          }).to.be.throw(/.*function or trigger used with a parameter without any type/)
        ]);
      });
    });

    describe('indexes', function () {
      beforeEach(function () {
        var self = this;
        return this.queryInterface.dropTable('Group').then(function () {
          return self.queryInterface.createTable('Group', {
            username: DataTypes.STRING,
            isAdmin: DataTypes.BOOLEAN,
            from: DataTypes.STRING
          });
        });
      });

      it('adds, reads and removes a named functional index to the table', function () {
        var self = this;
        return this.queryInterface.addIndex('Group', [this.sequelize.fn('lower', this.sequelize.col('username'))], {
          name: 'group_username_lower'
        }).then(function () {
          return self.queryInterface.showIndex('Group').then(function (indexes) {
            var indexColumns = _.uniq(indexes.map(function (index) {
              return index.name;
            }));
            expect(indexColumns).to.include('group_username_lower');
            return self.queryInterface.removeIndex('Group', 'group_username_lower').then(function () {
              return self.queryInterface.showIndex('Group').then(function (indexes) {
                indexColumns = _.uniq(indexes.map(function (index) {
                  return index.name;
                }));
                expect(indexColumns).to.be.empty;
              });
            });
          });
        });
      });
    });
  });
}
