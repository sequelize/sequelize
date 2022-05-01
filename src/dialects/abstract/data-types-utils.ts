import { logger } from '../../utils/logger.js';

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
