interface NumberConstructor {
  isNaN(number: unknown): number is Number.NaN;
}

export type Falsy = false | 0 | -0 | 0n | '' | null | undefined | NumberConstructor.isNaN;
