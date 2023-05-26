declare module 'toposort-class' {
  export default class Toposort {
    add(node: string, dependencies: string[]): void;
    sort(): string[];
  }
}
