// fix NaN returning issue https://github.com/Microsoft/TypeScript/issues/28682
interface NumberConstructor {
	isNaN(number: unknown): number is NaN;
}

export type Falsy = false | 0 | -0 | 0n | '' | null | undefined | NumberConstructor.isNaN;
