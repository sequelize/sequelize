-- Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

create user sequelizetest identified by sequelizepassword;
grant all privileges to sequelizetest;
alter user sequelizetest quota unlimited on users;
exit;
