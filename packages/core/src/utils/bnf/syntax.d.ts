import type _Shared from './shared.js';
export type _Literal = { type: "literal", value: string, start: number, end: number, count: number, ref: _Shared.ReferenceRange };
export type Term_Attribute = {
	type: 'attribute',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		Term_AttributeBegin,
		{ type: '(...)*', value: Array<Term_JsonAccess>, start: number, end: number, count: number, ref: _Shared.ReferenceRange },
		{ type: '(...)*', value: Array<Term_Transform>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
	]
}
export declare function Parse_Attribute (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Attribute,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_AttributeBegin = {
	type: 'attributeBegin',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		(Term_Association | _Literal)
	]
}
export declare function Parse_AttributeBegin (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_AttributeBegin,
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
		{ type: '(...)+', value: [Term_JsonAccess] & Array<Term_JsonAccess>, start: number, end: number, count: number, ref: _Shared.ReferenceRange },
		{ type: '(...)*', value: Array<Term_Transform>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
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
		{ type: '(...)+', value: [(_Literal | _Literal | Term_Digit | _Literal & {value: "\x5f"})] & Array<(_Literal | _Literal | Term_Digit | _Literal & {value: "\x5f"})>, start: number, end: number, count: number, ref: _Shared.ReferenceRange }
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
		_Literal
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
		_Literal
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
		_Literal,
		{ type: '(...)*', value: Array<{
	type: '(...)',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		_Literal
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

export type Term_JsonAccess = {
	type: 'jsonAccess',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		(Term_IndexAccess | Term_KeyAccess)
	]
}
export declare function Parse_JsonAccess (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_JsonAccess,
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
		_Literal
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
		_Literal
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
		(Term_NonEmptyString | { type: '(...)+', value: [(_Literal | _Literal | Term_Digit | _Literal & {value: "\x5f"} | _Literal & {value: "\x2d"})] & Array<(_Literal | _Literal | Term_Digit | _Literal & {value: "\x5f"} | _Literal & {value: "\x2d"})>, start: number, end: number, count: number, ref: _Shared.ReferenceRange })
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
		_Literal
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
		(_Literal & {value: "\x22"} | _Literal & {value: "\x5c"})
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
		_Literal
	]
}
export declare function Parse_AnyExceptQuoteOrBackslash (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_AnyExceptQuoteOrBackslash,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}

export type Term_Transform = {
	type: 'transform',
	start: number,
	end: number,
	count: number,
	ref: _Shared.ReferenceRange,
	value: [
		(Term_Cast | Term_Modifier)
	]
}
export declare function Parse_Transform (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Transform,
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
		_Literal
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
		_Literal
	]
}
export declare function Parse_Modifier (i: string, refMapping?: boolean): _Shared.ParseError | {
	root: _Shared.SyntaxNode & Term_Modifier,
	reachBytes: number,
	reach: null | _Shared.Reference,
	isPartial: boolean
}
