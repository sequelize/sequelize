-- Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

-- Make sqlplus exit with a failure code on the first error instead of silently continuing.
whenever sqlerror exit failure;
whenever oserror exit failure;

create user sequelizetest identified by sequelizepassword;
grant all privileges to sequelizetest;
alter user sequelizetest quota unlimited on users;
exit;
