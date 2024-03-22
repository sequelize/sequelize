export declare function freezeDeep<T extends object>(obj: T): T;
/**
 * Only freezes the descendants of an object, not the object itself.
 *
 * @param obj
 */
export declare function freezeDescendants<T extends object>(obj: T): T;
