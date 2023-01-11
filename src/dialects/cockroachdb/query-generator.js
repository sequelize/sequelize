import { CockroachDbQueryGeneratorTypeScript } from './query-generator-typescript';

export class CockroachDbQueryGenerator extends CockroachDbQueryGeneratorTypeScript {
  fromArray(text) {
    let patchedText = typeof text === 'string' ? text : `{${text.join(',')}}`;
    if (Array.isArray(patchedText)) {
      return text;
    }

    patchedText = patchedText.replace(/^{/, '').replace(/}$/, '');
    let matches = patchedText.match(/("(?:\\.|[^"\\])*"|[^,]*)(?:\s*,\s*|\s*$)/gi) || [];

    if (matches.length === 0) {
      return [];
    }

    matches = matches.map(m => m
      .replace(/",$/, '')
      .replace(/,$/, '')
      .replace(/(^"|"$)/g, ''));

    return matches.slice(0, -1);
  }
}
