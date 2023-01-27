import { isString } from './check.js';
import { Attribute, Cast, JsonPath, AssociationPath } from './sequelize-method.js';

/**
 * Parses the attribute syntax into its "SequelizeMethod" representation.
 *
 * @example
 * ```ts
 * parseAttribute('id') // => attribute('id')
 * parseAttribute('$user.id$') // => association(['user'], 'id')
 * parseAttribute('json.key') // => jsonPath(attribute('json'), ['key'])
 * parseAttribute('name::number') // => cast(attribute('name'), 'number')
 * parseAttribute('json.key::number') // => cast(jsonPath(attribute('json'), ['key']), 'number')
 * ```
 *
 * @param attrOrStr The syntax to parse
 */
// TODO: memoize
export function parseAttributeSyntax(attrOrStr: string | Attribute): Cast | JsonPath | AssociationPath | Attribute {
  const syntax = isString(attrOrStr) ? attrOrStr : attrOrStr.attributeName;

  const castMatch = syntax.match(/(?<remainder>.+)::(?<cast>[a-zA-Z]+)$/);
  if (castMatch) {
    // castMatch.groups.remainder
    const { cast, remainder } = castMatch.groups!;

    return new Cast(parseAttributeSyntax(remainder), cast);
  }

  const associationMatch = syntax.match(/^\$(?<path>.+)\$(?:$|.(?<remainder>.+))/);

  let jsonPath: string[];
  if (associationMatch) {
    const { path: pathStr, remainder } = associationMatch.groups!;
    jsonPath = [pathStr];
    if (remainder) {
      jsonPath.push(...parseJsonPath(remainder));
    }
  } else {
    jsonPath = parseJsonPath(syntax);
  }

  if (jsonPath.length > 1) {
    const attrOrAssociation = jsonPath.shift()!;

    return new JsonPath(splitAssociationPath(attrOrAssociation), jsonPath);
  }

  return splitAssociationPath(jsonPath[0]);
}

function parseJsonPath(syntax: string): string[] {
  return stringToPath(syntax);
}

function splitAssociationPath(syntax: string): AssociationPath | Attribute {
  const path = syntax.split('.');

  if (path.length > 1) {
    const attr = path.pop()!;

    return new AssociationPath(path, attr);
  }

  return new Attribute(syntax);
}

// Source: https://github.com/lodash/lodash/blob/2da024c3b4f9947a48517639de7560457cd4ec6c/.internal/stringToPath.js

const charCodeOfDot = '.'.codePointAt(0);
const reEscapeChar = /\\(\\)?/g;
const rePropName = new RegExp(
  // Match anything that isn't a dot or bracket.
  // eslint-disable-next-line no-useless-concat
  '[^.[\\]]+' + '|'
  // Or match property names within brackets.
  + '\\[(?:'
  // Match a non-string expression.
  // eslint-disable-next-line no-useless-concat
  + '([^"\'][^[]*)' + '|'
  // Or match strings (supports escaping characters).
  + '(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2'
  // eslint-disable-next-line no-useless-concat
  + ')\\]' + '|'
  // Or match "" as the space between consecutive dots or empty brackets.
  + '(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))'
  , 'g',
);

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param val The string to convert.
 * @returns Returns the property path array.
 */
const stringToPath = (val: string): string[] => {
  const result: string[] = [];
  if (val.codePointAt(0) === charCodeOfDot) {
    result.push('');
  }

  // @ts-expect-error -- 3 end parameters are rest parameters
  val.replace(rePropName, (match: string, expression, quote, subString) => {
    let key = match;
    if (quote) {
      key = subString.replace(reEscapeChar, '$1');
    } else if (expression) {
      key = expression.trim();
    }

    result.push(key);
  });

  return result;
};
