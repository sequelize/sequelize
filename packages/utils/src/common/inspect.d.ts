/**
 * Stringify a value, for use in debug messages.
 * This is a bare-bones implementation of node:util's inspect method, designed to run in any environment.
 *
 * @param value The value to stringify
 * @returns A string representation of the value
 */
export declare function inspect(value: unknown): string;
