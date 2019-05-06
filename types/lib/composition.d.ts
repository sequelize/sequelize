import { AbstractDataType, AbstractDataTypeConstructor } from './data-types'

export class Slot {
    public value: any
    public field?: AbstractDataType | AbstractDataTypeConstructor
    public options?: object
    constructor(value: any, field?: AbstractDataType | AbstractDataTypeConstructor, options?: object)
}

export class Placeholder {
    public name: string
    constructor(name?: string)
}

export interface Composable<T> {
    items: (string | Slot | Placeholder)[]
    length(): number
    add(...items: (string | Slot | Placeholder | T)[]): this
    prepend(...items: (string | Slot | Placeholder | T)[]): this
    set(...items: (string | Slot | Placeholder | T)[]): this
    clone(): T
}

export class Composition implements Composable<Composition> {
    public items: (string | Slot | Placeholder)[]
    public length(): number
    public add(...items: (string | Slot | Placeholder | Composition)[]): this
    public prepend(...items: (string | Slot | Placeholder | Composition)[]): this
    public set(...items: (string | Slot | Placeholder | Composition)[]): this
    public clone(): Composition
    constructor(...items: (string | Slot | Placeholder | Composition)[])
}
