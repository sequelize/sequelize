const GRACE_PERIOD_MS = 5000;
const FLUSH_TIMEOUT_MS = 1000;

interface ExitGracePeriodOptions {
  exit?(code: number): void;
  /** Writes the warning and calls `flushed` once pending output has been written. */
  warn?(message: string, flushed: () => void): void;
  flushTimeoutMs?: number;
}

function warnOnStderr(message: string, flushed: () => void): void {
  // stdout & stderr are asynchronous when piped on POSIX systems (see "A note on process I/O"),
  // so exiting right away could drop the warning or other pending output.
  let pendingWrites = 2;
  const onWritten = () => {
    pendingWrites--;
    if (pendingWrites === 0) {
      flushed();
    }
  };

  process.stdout.write('', onWritten);
  process.stderr.write(`${message}\n`, onWritten);
}

/**
 * Commands close their database connection when they are done. If something else keeps the
 * process alive (e.g. a timer left open by a migration), warn and exit instead of hanging.
 *
 * @param delayMs
 * @param options
 */
export function exitAfterGracePeriod(
  delayMs: number = GRACE_PERIOD_MS,
  options: ExitGracePeriodOptions = {},
): NodeJS.Timeout {
  const {
    // eslint-disable-next-line unicorn/no-process-exit -- only called from the CLI entry point
    exit = code => process.exit(code),
    warn = warnOnStderr,
    flushTimeoutMs = FLUSH_TIMEOUT_MS,
  } = options;

  return setTimeout(() => {
    const resources = process.getActiveResourcesInfo().join(', ') || 'unknown';
    const exitCode = Number(process.exitCode ?? 0);

    let exited = false;
    const exitOnce = () => {
      if (!exited) {
        exited = true;
        exit(exitCode);
      }
    };

    // don't let a blocked stream prevent the exit
    setTimeout(exitOnce, flushTimeoutMs).unref();

    warn(
      `The command finished, but the process was still running ${delayMs / 1000}s later (active resources: ${resources}). A migration or seed may have left a timer, socket or connection open. Exiting.`,
      exitOnce,
    );
  }, delayMs).unref();
}
