import type { Hookable } from './model';

// TODO: move this to "validate". "validate" should accept either ValidationOptions or a boolean
export interface ValidationOptions extends Hookable {
  /**
   * An array of strings. All properties that are in this array will not be validated
   */
  skip?: string[];
  /**
   * An array of strings. Only the properties that are in this array will be validated
   */
  fields?: string[];
}
