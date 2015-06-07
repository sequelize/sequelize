#!/bin/sh -e

if [ "DIALECT"${DIALECT} = "DIALECToracle" ]
then
  #install oracledb only for dialect oracle
  npm install oracledb
else
	if [ "DIALECT"${DIALECT} = "DIALECTmysql" ]
	then
		mysql -e 'create database sequelize_test;'
	else
		if [ "DIALECT"${DIALECT} = "DIALECToracle" ]
		then
			psql -c 'create database sequelize_test;' -U postgres
		fi
	fi
fi