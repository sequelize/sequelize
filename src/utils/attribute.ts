
export function parseAttributeSyntax(syntax: string): CastNode | JsonNode | AssociationNode | AttributeNode {
  const castMatch = syntax.match(/(?<remainder>.+)::(?<cast>[a-zA-Z]+)$/);
  if (castMatch) {
    // castMatch.groups.remainder
    const { cast, remainder } = castMatch.groups!;

    return {
      type: 'cast',
      to: cast,
      attribute: parseAttributeSyntax(remainder),
    };
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

    return {
      type: 'json',
      path: jsonPath,
      attribute: splitAssociationPath(attrOrAssociation),
    };
  }

  return splitAssociationPath(jsonPath[0]);
}

function splitAssociationPath(str: string): AssociationNode | AttributeNode {
  const path = str.split('.');

  if (path.length > 1) {
    const attr = path.pop()!;

    return {
      type: 'association',
      path,
      attribute: {
        type: 'attribute',
        value: attr,
      },
    };
  }

  return {
    type: 'attribute',
    value: path[0],
  };
}

export type CastNode = {
  type: 'cast',
  to: string,
  attribute: CastNode | JsonNode | AssociationNode | AttributeNode,
};

export type JsonNode = {
  type: 'json',
  path: string[],
  attribute: AssociationNode | AttributeNode,
};

export type AssociationNode = {
  type: 'association',
  path: string[],
  attribute: AttributeNode,
};

export type AttributeNode = {
  type: 'attribute',
  value: string,
};
