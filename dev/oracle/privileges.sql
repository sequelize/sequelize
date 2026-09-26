-- Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

whenever sqlerror exit failure;
whenever oserror exit failure;

create user sequelizetest identified by sequelizepassword;
grant all privileges to sequelizetest;
alter user sequelizetest quota unlimited on users;
-- Let Oracle replace literals with bind variables so that dictionary queries (e.g. showIndex) are not hard parsed on every call
alter system set cursor_sharing = FORCE;
exit;
