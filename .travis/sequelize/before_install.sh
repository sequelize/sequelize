#!/bin/sh -e

if [ "DIALECT"${DIALECT} = "DIALECToracle" ] || [ "COVERAGE"${COVERAGE} = "COVERAGEtrue" ] 
then
  # Download and install Oracle XE
  export ORACLE_FILE="oracle-xe-11.2.0-1.0.x86_64.rpm.zip"
  export ORACLE_HOME="/u01/app/oracle/product/11.2.0/xe"
  export ORACLE_SID="XE"

  .travis/oracle/download.sh

  .travis/oracle/install.sh

  # Integrate Oracle Libraries (use by oracledb at build)
  export OCI_LIB_DIR="/u01/app/oracle/product/11.2.0/xe/lib"
  export OCI_INC_DIR="/u01/app/oracle/product/11.2.0/xe/rdbms/public"

  # Integrate Oracle Libraries (use by oracledb at execution)
  export LD_LIBRARY_PATH="/u01/app/oracle/product/11.2.0/xe/lib/"
  sudo ldconfig

  # Unlock count for HR ( default oracle user) if disable
  .travis/sequelize/user.sh
fi