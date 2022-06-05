# DB2 README

There are many versions of DB2 products, which have different features and different documentation. For instance, in this version `JSON_ARRAYAGG` and `ARRAY_AGG` functions are not available, only `LISTAGG` is.  To confirm this query can be run:

   ```bash
   db2 "select distinct routinename from syscat.routines where routinename like 'JSON%' or routinename like '%ARRAY%' or routinename like '%AGG%' order by 1"
   ```

Types of DB2 Platforms
- Linux/Unix/Windows (LUW) [on prem]
- Z/OS [on prem]
- i-series (as/400) [on prem]
- DB2-on-cloud [cloud]

## Connecting from CLI

```bash
# run the DB2 docker container
yarn start-db2

# connect to db2 (see Note 1-1 and 1-2)
sudo docker exec -ti db2server bash -c "su db2inst1"

# connect to database (see Note 1-3)
db2 connect to testdb
```

Notes:
1. DB2 container and database settings are defined in .env_list
   1. `db2server` is the container name
   1. `db2inst1` is the admin account created for the instance
   1. `testdb` is the database name

## Using CLI

### When Disconnected from the Database
Commands | Description
-------- | -----------
`db2 connect to <db_name>` | connect to the database
`db2 connect reset` | disconnects from the database
`db2 deactivate db <db_name>` | take the database offline
`db2 drop db <db_name>` | **WARNING!** delete the database
`db2ls` | list database install info
`db2ls -a -q -b /opt/ibm/db2/V11.5` | show installed database features 

### When Connected to the Database
Once connected commands may be called from the command line using prefixed by `db2` in the format `db2 "command"` or `db2 "query"`.

Example:
```bash
# query a system table
db2 "select tabname from syscat.tables fetch first 3 rows only"

# list db directory
db2 "list db directory"
# -or-
db2 list db directory
```

An interactive mode is also available simply by running: 
```bash
db2
```
Then statements can be issued ad-hoc:
```sql
SELECT tabname FROM syscat.tables WHERE tabschema='DB2INST1'
```

Commands | Description | Example
-------- | ----------- | ---
`describe table <tablename>` | View table's schema (e.g., Users) with optional `show detail` to display additional info | `describe table "Users" show detail`

## Disconnecting / Logging out
```bash
# Disconnect from database
db2 connect reset

# Logout of Docker
logout
```

---

More Info: https://www.ibm.com/docs/en/db2/11.5?topic=system-linux