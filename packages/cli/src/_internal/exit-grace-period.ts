const GRACE_PERIOD_MS = 5000;

interface ExitGracePeriodOptions {
  exit?(code: number): void;
  warn?(message: string): void;
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
  // eslint-disable-next-line unicorn/no-process-exit -- only called from the CLI entry point
  const { exit = code => process.exit(code), warn = console.warn } = options;

  return setTimeout(() => {
    const resources = process.getActiveResourcesInfo().join(', ') || 'unknown';

    warn(
      `The command finished, but the process was still running ${delayMs / 1000}s later (active resources: ${resources}). A migration or seed may have left a timer, socket or connection open. Exiting.`,
    );

    exit(Number(process.exitCode ?? 0));
  }, delayMs).unref();
}
