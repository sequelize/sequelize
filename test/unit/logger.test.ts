/* eslint-env mocha */

import sinon from 'sinon';
import { expect } from 'chai';
import { Logger, logger as defaultLogger } from 'sequelize/lib/utils/logger';
import { inspect as nodeInspect } from 'util';

describe('logger', () => {
  let oldWarn: typeof console.warn;
  let fakeWarn: sinon.SinonSpy;

  beforeEach(() => {
    oldWarn = console.warn;
    fakeWarn = sinon.fake();
    console.warn = fakeWarn;
  });

  afterEach(() => {
    console.warn = oldWarn;
  });

  it('creates a default logger in the sequelize context', () => {
    defaultLogger.warn('abc');

    expect(fakeWarn.calledOnceWithExactly('(sequelize) Warning: abc')).to.equal(
      true
    );
  });

  it("defaults the context of new loggers to 'sequelize'", () => {
    const logger = new Logger();

    logger.warn('oh no');
    expect(
      fakeWarn.calledOnceWithExactly('(sequelize) Warning: oh no')
    ).to.equal(true);
  });

  it('respects specified context in new loggers', () => {
    const logger = new Logger({ context: 'query-generator' });

    logger.warn('This feature is not supported for this dialect.');

    expect(
      fakeWarn.calledOnceWithExactly(
        '(query-generator) Warning: This feature is not supported for this dialect.'
      )
    ).to.equal(true);
  });

  it('inspects a value', () => {
    const obj = {
      a: 1,
      b: 2,
      c() {
        /* no-op */
      }
    };

    expect(defaultLogger.inspect(obj)).to.equal(
      nodeInspect(obj, { showHidden: false, depth: 3 })
    );
  });

  it('creates a debugger in the correct namespace', () => {
    const contextDebugger = defaultLogger.debugContext('query-generator');

    expect(contextDebugger.namespace).to.equal('sequelize:query-generator');
  });
});
