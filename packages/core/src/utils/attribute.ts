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
export function parseAttributeSyntax(attrOrStr: string | Attribute): Cast | JsonPath | AssociationPath | Attribute {
  const syntax = isString(attrOrStr) ? attrOrStr : attrOrStr.attributeName;

  const castMatch = syntax.match(/(?<remainder>.+)::(?<cast>[a-zA-Z]+)$/);
  if (castMatch) {
    // castMatch.groups.remainder
    const { cast, remainder } = castMatch.groups!;

    return new Cast(parseAttributeSyntax(remainder), cast);
  }

  const associationMatch = syntax.match(/^\$(?<path>.+)\$(?:$|.(?<remainder>.+))/);

  let jsonPath;
  if (associationMatch) {
    const { path: pathStr, remainder } = associationMatch.groups!;
    jsonPath = [pathStr];
    if (remainder) {
      jsonPath.push(...remainder.split('.'));
    }
  } else {
    jsonPath = syntax.split('.');
  }

  if (jsonPath.length > 1) {
    const attrOrAssociation = jsonPath.shift()!;

    return new JsonPath(splitAssociationPath(attrOrAssociation), jsonPath);
  }

  return splitAssociationPath(jsonPath[0]);
}

function splitAssociationPath(syntax: string): AssociationPath | Attribute {
  const path = syntax.split('.');

  if (path.length > 1) {
    const attr = path.pop()!;

    return new AssociationPath(path, attr);
  }

  return new Attribute(syntax);
}
