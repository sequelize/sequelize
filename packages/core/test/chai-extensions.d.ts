declare namespace Chai {
  interface Assertion {
    throwWithCause: Throw;
    beNullish(): void;
    notBeNullish(): void;
  }
}

// @types/chai v5 no longer declares the `should` property that `chai.should()` adds to every object
interface Object {
  should: Chai.Assertion;
}
