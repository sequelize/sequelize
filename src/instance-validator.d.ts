import { Hookable } from "./model";

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
