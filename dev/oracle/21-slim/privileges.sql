-- Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

create user sequelizetest identified by sequelizepassword;
grant connect to sequelizetest with admin option;
grant create session to sequelizetest with admin option;
grant grant any privilege to sequelizetest with admin option;
grant grant any role to sequelizetest with admin option;
grant create any table to sequelizetest with admin option;
grant insert any table to sequelizetest with admin option;
grant select any table to sequelizetest with admin option;
grant update any table to sequelizetest with admin option;
grant delete any table to sequelizetest with admin option;
grant drop any table to sequelizetest with admin option;
grant create view to sequelizetest with admin option;
grant create user to sequelizetest with admin option;
grant drop user to sequelizetest with admin option;
grant create any trigger to sequelizetest with admin option;
grant create any procedure to sequelizetest with admin option;
grant create any sequence to sequelizetest with admin option;
grant select any sequence to sequelizetest with admin option;
grant drop any sequence to sequelizetest with admin option;
grant create any synonym to sequelizetest with admin option;
grant create any index to sequelizetest with admin option;
grant alter user to sequelizetest with admin option;
grant alter any table to sequelizetest with admin option;
alter user sequelizetest quota unlimited on users;
exit;
