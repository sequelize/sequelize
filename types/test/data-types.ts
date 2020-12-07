import { INTEGER, IntegerDataType, TINYINT } from 'sequelize';
import { AbstractDataTypeConstructor, BIGINT, CIDR, INET, MACADDR, CITEXT, BigIntDataType, BOOLEAN, HSTORE, JSON, JSONB, MEDIUMINT, MediumIntegerDataType, NOW, SMALLINT, SmallIntegerDataType, TIME, UUID, UUIDV1, UUIDV4 } from '../lib/data-types';

let tinyint: IntegerDataType;
tinyint = TINYINT();
tinyint = new TINYINT();
tinyint = TINYINT.UNSIGNED.ZEROFILL();
tinyint = new TINYINT.UNSIGNED.ZEROFILL();

let smallint: SmallIntegerDataType;
smallint = SMALLINT();
smallint = new SMALLINT();
smallint = SMALLINT.UNSIGNED.ZEROFILL();
smallint = new SMALLINT.UNSIGNED.ZEROFILL();

let mediumint: MediumIntegerDataType;
mediumint = MEDIUMINT();
mediumint = new MEDIUMINT();
mediumint = MEDIUMINT.UNSIGNED.ZEROFILL();
mediumint = new MEDIUMINT.UNSIGNED.ZEROFILL();

let int: IntegerDataType;
int = INTEGER();
int = new INTEGER();
int = INTEGER.UNSIGNED.ZEROFILL();
int = new INTEGER.UNSIGNED.ZEROFILL();

let bigint: BigIntDataType;
bigint = BIGINT();
bigint = new BIGINT();
bigint = BIGINT.UNSIGNED.ZEROFILL();
bigint = new BIGINT.UNSIGNED.ZEROFILL();

const validateAbstractDataTypeConstructorLabel =
  <T>(obj: T extends AbstractDataTypeConstructor<infer Label> ? Label : never) =>
    undefined

validateAbstractDataTypeConstructorLabel<typeof BOOLEAN>("boolean")
validateAbstractDataTypeConstructorLabel<typeof TIME>("time")
validateAbstractDataTypeConstructorLabel<typeof HSTORE>("hstore")

validateAbstractDataTypeConstructorLabel<typeof JSON>("json")
validateAbstractDataTypeConstructorLabel<typeof JSONB>("jsonb")
validateAbstractDataTypeConstructorLabel<typeof NOW>("now")

validateAbstractDataTypeConstructorLabel<typeof UUID>("uuid")
validateAbstractDataTypeConstructorLabel<typeof UUIDV1>("uuidv1")
validateAbstractDataTypeConstructorLabel<typeof UUIDV4>("uuidv4")

validateAbstractDataTypeConstructorLabel<typeof CIDR>("cidr")
validateAbstractDataTypeConstructorLabel<typeof INET>("inet")
validateAbstractDataTypeConstructorLabel<typeof MACADDR>("macaddr")
validateAbstractDataTypeConstructorLabel<typeof CITEXT>("citext")
