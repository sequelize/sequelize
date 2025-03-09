declare namespace Chai {
  interface Assertion {
    throwWithCause: Throw;
    beNullish(): void;
    notBeNullish(): void;
  }
}
