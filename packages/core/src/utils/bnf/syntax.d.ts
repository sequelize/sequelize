import type _Shared from './shared.js';
export type Term_Attribute = {
	type: 'attribute',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }),
		{ type: '(...)?', value: [] | [Term_JsonPath], start: number, end: number, count: number, ref: _Shared.ReferenceRange },
		{ type: '(...)?', value: [] | [Term_CastOrModifiers], start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Attribute (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Attribute,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_PartialJsonPath = {
	type: 'partialJsonPath',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }),
		{ type: '(...)?', value: [] | [Term_JsonPath], start: number, end: number, count: number, ref: _Shared.ReferenceRange },
		{ type: '(...)?', value: [] | [Term_CastOrModifiers], start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_PartialJsonPath (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_PartialJsonPath,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Identifier = {
	type: 'identifier',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: '(...)+', value: [({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | Term_Digit | { type: 'literal', value: '\x5f', start: number, end: number, count: number, ref: _Shared.ReferenceRange })] & Array<({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | Term_Digit | { type: 'literal', value: '\x5f', start: number, end: number, count: number, ref: _Shared.ReferenceRange })>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Identifier (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Identifier,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Digit = {
	type: 'digit',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Digit (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Digit,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Number = {
	type: 'number',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Number (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Number,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Association = {
	type: 'association',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		Term_Identifier,
		{ type: '(...)*', value: Array<{
	type: '(...)',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: 'literal', value: '\x2e', start: number, end: number, count: number, ref: _Shared.ReferenceRange },
		Term_Identifier
	]
}>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Association (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Association,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_JsonPath = {
	type: 'jsonPath',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: '(...)+', value: [({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange })] & Array<({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange })>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_JsonPath (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_JsonPath,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_IndexAccess = {
	type: 'indexAccess',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		Term_Number
	]
}
export declare function Parse_IndexAccess (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_IndexAccess,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_KeyAccess = {
	type: 'keyAccess',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		Term_Key
	]
}
export declare function Parse_KeyAccess (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_KeyAccess,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Key = {
	type: 'key',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		(Term_NonEmptyString | { type: '(...)+', value: [({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | Term_Digit | { type: 'literal', value: '\x5f', start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: '\x2d', start: number, end: number, count: number, ref: _Shared.ReferenceRange })] & Array<({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | Term_Digit | { type: 'literal', value: '\x5f', start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: '\x2d', start: number, end: number, count: number, ref: _Shared.ReferenceRange })>, start: number, end: number, count: number, ref: _Shared.ReferenceRange })
	]
}
export declare function Parse_Key (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Key,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_NonEmptyString = {
	type: 'nonEmptyString',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_NonEmptyString (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_NonEmptyString,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_EscapedCharacter = {
	type: 'escapedCharacter',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		({ type: 'literal', value: '\x22', start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: '\x5c', start: number, end: number, count: number, ref: _Shared.ReferenceRange })
	]
}
export declare function Parse_EscapedCharacter (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_EscapedCharacter,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_AnyExceptQuoteOrBackslash = {
	type: 'anyExceptQuoteOrBackslash',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_AnyExceptQuoteOrBackslash (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_AnyExceptQuoteOrBackslash,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_CastOrModifiers = {
	type: 'castOrModifiers',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: '(...)+', value: [({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange })] & Array<({ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange } | { type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange })>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_CastOrModifiers (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_CastOrModifiers,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Cast = {
	type: 'cast',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		Term_Identifier
	]
}
export declare function Parse_Cast (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Cast,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Modifier = {
	type: 'modifier',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		Term_Identifier
	]
}
export declare function Parse_Modifier (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Modifier,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Any = {
	type: 'any',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		{ type: 'literal', value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Any (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Any,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}
