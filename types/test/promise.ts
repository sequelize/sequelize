import { Promise } from 'sequelize';

let promise: Promise<number> = Promise.resolve(1);
promise.then((arg: number) => ({})).then((a: {}) => void 0);

promise = new Promise<number>(resolve => resolve());
