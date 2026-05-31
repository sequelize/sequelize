'use strict';

const ResourceLock = require('../../../../lib/dialects/mssql/resource-lock'),
  { delay } = require('../../../../lib/utils/promise-helpers'),
  assert = require('assert'),
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect();

// Mirrors the bluebird `Promise.using(lock.lock(), fn)` shape against the
// `{ acquire, release }` API exposed by ResourceLock.
async function using(lock, fn) {
  const { acquire, release } = lock.lock();
  const resource = await acquire;
  try {
    return await fn(resource);
  } finally {
    release(resource);
  }
}

if (dialect === 'mssql') {
  describe('[MSSQL Specific] ResourceLock', () => {
    it('should process requests serially', () => {
      const expected = {};
      const lock = new ResourceLock(expected);
      let last = 0;

      function validateResource(actual) {
        assert.equal(actual, expected);
      }

      return Promise.all([
        using(lock, resource => {
          validateResource(resource);
          assert.equal(last, 0);
          last = 1;

          return delay(15);
        }),
        using(lock, resource => {
          validateResource(resource);
          assert.equal(last, 1);
          last = 2;
        }),
        using(lock, resource => {
          validateResource(resource);
          assert.equal(last, 2);
          last = 3;

          return delay(5);
        })
      ]);
    });

    it('should still return resource after failure', () => {
      const expected = {};
      const lock = new ResourceLock(expected);

      function validateResource(actual) {
        assert.equal(actual, expected);
      }

      return Promise.all([
        using(lock, resource => {
          validateResource(resource);

          throw new Error('unexpected error');
        }).catch(() => {}),
        using(lock, validateResource)
      ]);
    });

    it('should be able to.lock resource without waiting on lock', () => {
      const expected = {};
      const lock = new ResourceLock(expected);

      assert.equal(lock.unwrap(), expected);
    });
  });
}
