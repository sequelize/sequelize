declare namespace Chai {
  interface Assertion {
    deepEqual(expected: any): Assertion['throw'];
  }
}
