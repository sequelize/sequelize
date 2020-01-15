import { INTEGER, IntegerDataType, TINYINT } from 'sequelize';
import { SmallIntegerDataType, SMALLINT, MEDIUMINT, MediumIntegerDataType, BigIntDataType, BIGINT } from '../lib/data-types';

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
