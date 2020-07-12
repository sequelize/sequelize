declare module 'toposort-class' {
  class Toposort {
    add(item: string, deps: string | string[]): Toposort;
    sort(): string[];
    clear(): Toposort;
    Toposort: typeof Toposort;
  }
  export = Toposort;
}
