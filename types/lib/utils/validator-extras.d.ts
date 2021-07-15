// tslint:disable-next-line:no-implicit-dependencies
import * as val from 'validator';

type OrigValidator = typeof val;

export interface Extensions {
  notEmpty(str: string): boolean;
  len(str: string, min: number, max: number): boolean;
  isUrl(str: string): boolean;
  isIPv6(str: string): boolean;
  isIPv4(str: string): boolean;
  notIn(str: string, values: string[]): boolean;
  regex(str: string, pattern: string, modifiers: string): boolean;
  notRegex(str: string, pattern: string, modifiers: string): boolean;
  min(str: string, val: number): boolean;
  max(str: string, val: number): boolean;
  not(str: string, pattern: string, modifiers: string): boolean;
  contains(str: string, elem: string[]): boolean;
  notContains(str: string, elem: string[]): boolean;
  is(str: string, pattern: string, modifiers: string): boolean;
}
export const extensions: Extensions;

export interface Validator extends OrigValidator, Extensions {
  contains(str: string, elem: string[]): boolean;
}
export const validator: Validator;
