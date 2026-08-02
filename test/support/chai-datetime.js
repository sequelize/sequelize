// Local replacement for the unmaintained chai-datetime package.
// Implements only the matchers this suite uses.
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function (chai) {
  const { Assertion } = chai;

  Assertion.addMethod('equalTime', function (expected) {
    const actual = this._obj;
    this.assert(
      actual.getTime() === expected.getTime(),
      `expected ${actual.toISOString()} to equal ${expected.toISOString()}`,
      `expected ${actual.toISOString()} to not equal ${expected.toISOString()}`
    );
  });

  Assertion.addMethod('equalDate', function (expected) {
    const actual = this._obj;
    this.assert(
      sameDay(actual, expected),
      `expected ${actual.toDateString()} to be the same date as ${expected.toDateString()}`,
      `expected ${actual.toDateString()} to not be the same date as ${expected.toDateString()}`
    );
  });

  Assertion.addMethod('afterTime', function (expected) {
    const actual = this._obj;
    this.assert(
      actual.getTime() > expected.getTime(),
      `expected ${actual.toISOString()} to be after ${expected.toISOString()}`,
      `expected ${actual.toISOString()} to not be after ${expected.toISOString()}`
    );
  });

  Assertion.addMethod('beforeTime', function (expected) {
    const actual = this._obj;
    this.assert(
      actual.getTime() < expected.getTime(),
      `expected ${actual.toISOString()} to be before ${expected.toISOString()}`,
      `expected ${actual.toISOString()} to not be before ${expected.toISOString()}`
    );
  });

  Assertion.addMethod('withinTime', function (start, finish) {
    const actual = this._obj.getTime();
    this.assert(
      actual >= start.getTime() && actual <= finish.getTime(),
      `expected ${this._obj.toISOString()} to be within ${start.toISOString()} and ${finish.toISOString()}`,
      `expected ${this._obj.toISOString()} to not be within ${start.toISOString()} and ${finish.toISOString()}`
    );
  });
}
