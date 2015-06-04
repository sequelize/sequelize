#!/bin/sh -e

if [ "DIALECT"${DIALECT} = "DIALECToracle" ]
then
  #install oracledb only for dialect oracle
  npm install oracledb
fi