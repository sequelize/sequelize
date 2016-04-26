'use strict';

var ResourceLock = require('../../../../lib/dialects/mssql/resource-lock')
  , Promise = require('../../../../lib/promise')
  , assert = require('assert');

describe('[MSSQL Specific] ResourceLock', function () {
  it('should process requests serially', function () {
    var expected = {};
    var lock = new ResourceLock(expected);
    var last = 0;

    function validateResource(actual) {
      assert.equal(actual, expected);
    }

    return Promise.all([
      Promise.using(lock.lock(), function (resource) {
        validateResource(resource);
        assert.equal(last, 0);
        last = 1;

        return Promise.delay(15);
      }),
      Promise.using(lock.lock(), function (resource) {
        validateResource(resource);
        assert.equal(last, 1);
        last = 2;
      }),
      Promise.using(lock.lock(), function (resource) {
        validateResource(resource);
        assert.equal(last, 2);
        last = 3;

        return Promise.delay(5);
      })
    ]);
  });

  it('should still return resource after failure', function () {
    var expected = {};
    var lock = new ResourceLock(expected);

    function validateResource(actual) {
      assert.equal(actual, expected);
    }

    return Promise.all([
      Promise.using(lock.lock(), function (resource) {
        validateResource(resource);

        throw new Error('unexpected error');
      }).catch(function () {}),
      Promise.using(lock.lock(), validateResource)
    ]);
  });

  it('should be able to.lock resource without waiting on lock', function () {
    var expected = {};
    var lock = new ResourceLock(expected);

    assert.equal(lock.unwrap(), expected);
  });
});
