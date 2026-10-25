import { expect } from 'chai';
import { exitAfterGracePeriod } from './exit-grace-period.js';

describe('exitAfterGracePeriod', () => {
  it('warns and exits with the exit code if the process is still running after the grace period', async () => {
    const interval = setInterval(() => {}, 1000);
    const previousExitCode = process.exitCode;
    process.exitCode = 3;

    try {
      let warning = '';
      const { promise: exitCode, resolve } = Promise.withResolvers<number>();
      exitAfterGracePeriod(10, {
        exit: resolve,
        warn: message => {
          warning = message;
        },
      });

      expect(await exitCode).to.equal(3);
      expect(warning).to.match(/active resources: .*Timeout/);
    } finally {
      clearInterval(interval);
      process.exitCode = previousExitCode;
    }
  });

  it('does not keep the process alive itself', () => {
    const timer = exitAfterGracePeriod(10, { exit() {}, warn() {} });

    expect(timer.hasRef()).to.equal(false);
    clearTimeout(timer);
  });
});
