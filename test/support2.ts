// TODO: merge me with support.js once it has been migrated to TS

import type { ExclusiveTestFunction, PendingTestFunction, TestFunction } from 'mocha';

type Tester<Params extends any[]> = {
  (...params: Params): void,
  skip(...params: Params): void,
  only(...params: Params): void,
};

type TestFunctions = ExclusiveTestFunction | TestFunction | PendingTestFunction;

export function createTester<Params extends any[]>(
  cb: ((testFunction: TestFunctions, ...args: Params) => void),
): Tester<Params> {
  function tester(...params: Params) {
    cb(it, ...params);
  }

  tester.skip = function skippedTester(...params: Params) {
    cb(it.skip, ...params);
  };

  tester.only = function onlyTester(...params: Params) {
    cb(it.only, ...params);
  };

  return tester;
}
