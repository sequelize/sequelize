// tslint:disable-next-line:no-implicit-dependencies
import * as Bluebird from 'bluebird';

export const Promise: typeof Bluebird;
export type Promise<T> = Bluebird<T>;
export default Promise;
