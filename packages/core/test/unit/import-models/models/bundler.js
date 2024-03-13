/**
 *
 * Simulate the behavior of bundler (esbuild, rollup ...) converting `ECMAScript` to `CommonJS`.
 * Source code
 *
import { Model } from "@sequelize/core";

export class Bundler extends Model {};
 */
const __defProp = Object.defineProperty;
const __getOwnPropDesc = Object.getOwnPropertyDescriptor;
const __getOwnPropNames = Object.getOwnPropertyNames;
const __hasOwnProp = Object.prototype.hasOwnProperty;
const __export = (target, all) => {
  for (const name in all) {
    __defProp(target, name, { get: all[name], enumerable: true });
  }
};

const __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (const key of __getOwnPropNames(from)) {
      if (!__hasOwnProp.call(to, key) && key !== except) {
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
      }
    }
  }

  return to;
};

const __toCommonJS = mod => __copyProps(__defProp({}, '__esModule', { value: true }), mod);

// src/bundler.ts
const bundler_exports = {};
__export(bundler_exports, {
  Bundler: () => Bundler,
});
module.exports = __toCommonJS(bundler_exports);
const import_core = require('@sequelize/core');

const Bundler = class extends import_core.Model {};
