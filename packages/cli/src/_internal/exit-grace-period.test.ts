import { expect } from 'chai';
import { exitAfterGracePeriod } from './exit-grace-period.js';

describe('exitAfterGracePeriod', () => {
  let interval: NodeJS.Timeout;
  let previousExitCode: typeof process.exitCode;

  beforeEach(() => {
    // simulates a migration that left a timer running
    interval = setInterval(() => {}, 1000);
    previousExitCode = process.exitCode;
    process.exitCode = 3;
  });

  afterEach(() => {
    clearInterval(interval);
    process.exitCode = previousExitCode;
  });

  it('warns, then exits with the exit code once the warning has been written', async () => {
    const events: string[] = [];
    const { promise: exitCode, resolve } = Promise.withResolvers<number>();

    exitAfterGracePeriod(10, {
      exit: resolve,
      warn(message, flushed) {
        events.push(message);
        flushed();
      },
    });

    expect(await exitCode).to.equal(3);
    expect(events).to.have.lengthOf(1);
    expect(events[0]).to.match(/active resources: .*Timeout/);
  });

  it('exits even if the warning is never flushed', async () => {
    const { promise: exitCode, resolve } = Promise.withResolvers<number>();

    exitAfterGracePeriod(10, { exit: resolve, warn() {}, flushTimeoutMs: 10 });

    expect(await exitCode).to.equal(3);
  });

  it('does not keep the process alive itself', () => {
    const timer = exitAfterGracePeriod(10, { exit() {}, warn() {} });

    expect(timer.hasRef()).to.equal(false);
    clearTimeout(timer);
  });
});
