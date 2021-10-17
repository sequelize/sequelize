'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  Sequelize = Support.Sequelize,
  Promise = Sequelize.Promise,
  Bluebird = require('bluebird'),
  AsyncHooks = require('async_hooks');


const currentId = AsyncHooks.executionAsyncId;

const tree = new Set();
const hook = AsyncHooks.createHook({
  init(asyncId, _, triggerId) {
    if (tree.has(triggerId)) {
      tree.add(asyncId);
    }
  }
});



describe('Promise', () => {
  it('should be an independent copy of bluebird library', () => {
    expect(Promise.prototype.then).to.be.a('function');
    expect(Promise).to.not.equal(Bluebird);
    expect(Promise.prototype).to.not.equal(Bluebird.prototype);
  });

  it('should keep async id across bluebird promises', () => {
    // Based on the test from https://github.com/petkaantonov/bluebird/blob/808fdf8fce0cf4dbb1b95129607777a0cd53df36/test/mocha/async_hooks.js#L68
    // Looks like there is no way to test if flag is on beside testing that it works
    hook.enable();
    tree.add(currentId());
    const d1 = new Promise(resolve => {
      setTimeout(() => {
        setTimeout(resolve, 1);
      }, 1);
    });

    return new Promise(resolve => {
      resolve(Promise.map([d1, null, Promise.resolve(1), Promise.delay(1)], () => {
        return currentId();
      }).then(asyncIds => {
        for (let i = 0; i < asyncIds.length; ++i) {
          expect(asyncIds[i]).to.not.equal(true);
        }
      }));
    });
  });
});
