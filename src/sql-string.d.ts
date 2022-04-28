export type Escapable = undefined | null | boolean | number | string | Date;
export function escape(val: Escapable | Escapable[], timeZone?: string, dialect?: string, format?: boolean): string;
