import type { Class } from 'type-fest';
import { logger } from '../../utils/logger.js';
import type { DataType } from './data-types.js';
import { AbstractDataType } from './data-types.js';

const printedWarnings = new Set<string>();

export function createDataTypesWarn(link: string) {
  return (text: string) => {
    if (printedWarnings.has(text)) {
      return;
    }

    printedWarnings.add(text);
    logger.warn(`${text} \n>> Check: ${link}`);
  };
}

export function isDataType(value: any): value is DataType {
  return isDataTypeClass(value) || value instanceof AbstractDataType;
}

export function isDataTypeClass(value: any): value is Class<AbstractDataType<any>> {
  return typeof value === 'function' && value.prototype instanceof AbstractDataType;
}
