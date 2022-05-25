# Contributing: Cheatsheet

The [CONTRIBUTING](CONTRIBUTING.md) doc provides an extensive amount of information. Below is a summary of that info to get up-and-running quickly, with a few additional explanations.

## Pre-Requisites

1. Have docker installed
1. Have `yarn` installed (see _Helpful Notes_ section below)
1. Have the database installed and running

   Test Type | Requires Running Database
   ---         | --- |
   Unit        | No  |
   Integration | Yes |
   Other       | Yes | 

   Note:
   - tests DO NOT automatically start the database they're testing against  
   (see _Helpful Notes_ section below)
   - if the database is not running, you may encounter an error message similar to:
      ```bash
      SequelizeConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:23010
      ```

---

## Running Tests
This example will use _PostgreSQL_ as the database being contributed to. Replace _postgres_ with whatever dialect is specific to your changes.

The basic structure is start, test, stop. Start the database, run the test script, stop the database.

```bash
yarn start-postgres            # start the database
yarn test-integration-postgres # run the test
yarn stop-postgres             # stop the database
```

### Different Tests

Test | Description
---- | ---
`DIALECT=postgres yarn test` | **Type**: Full test of a database<br>**Requires**: specified dialect & running db
`yarn test-integration` | **Type**: Partial test<br>**Requires**: running db
`yarn test-unit` | **Type**: Partial test<br>**Requires**: no requirement can be run as-is
`DIALECT=postgres npx mocha test/**/query-generator.test.js` | **Type**: Specific test<br>**Notice**: it calls `mocha` directly <br>**Requires**: varies based on test

---

## Debugging / Cheatsheet

Command | Description
--- | ---
`console.log` | `node --inspect` is not currently utilized and would require modifications into the tests. In the meantime, use `console.log` for debugging
`docker ps -a` | Display running containers
`docker exec -it <container name> psql -d sequelize_test -U sequelize_test` | Connect to a running database inside the container and run psql (psql is PostgreSQL-only)

### PgAdmin4
1. Running pgadmin4 as a container (pgadmin is PostgreSQL-only)

   Create the container:
   ```bash
   docker run -d --name pgadmin4 -p 8888:80 -e 'PGADMIN_DEFAULT_EMAIL=test@example.com' -e 'PGADMIN_DEFAULT_PASSWORD=sequelize_test' dpage/pgadmin4
   ```

   Once the postgres container and the pgadmin container are both running, it's only a matter of ensuring they're on the same network.  
   
   Existing networks may be found with `docker network ls`:
   ```bash
   NETWORK ID     NAME                            DRIVER    SCOPE
   df4705da72d2   bridge                          bridge    local
   081ed5b71d99   host                            host      local
   c22cad586f28   none                            null      local
   092ed56f9f1b   sequelize-postgres-10-network   bridge    local
   ```
   
   The drivers with _bridge_ are of particular interest. More details can be found using `docker inspect`; for instance, `docker inspect sequelize-postgres-10-network`, reveals the containers bound to it:

   ```json
      ...
      "Containers": {
            "8544cdd984ebca72b8c819ca4195f6d130807fe7a9c2a49cb389926f2c2799d8": {
                "Name": "sequelize-postgres-10",
                "EndpointID": "ae0f4df1a94b16b7316d27b086f6e3506a06d692282272e5536762e1053a78f0",
                "MacAddress": "02:42:ac:16:00:02",
                "IPv4Address": "172.22.0.2/16",
                "IPv6Address": ""
            }
        },
      ...
   ```

   The idea is to have a network bridge that includes both containers. There are two ways to accomplish this:

   1. Add one of the containers to their existing bridges. Using the network we discovered above we can run:
      ```bash
      docker network connect sequelize-postgres-10-network pgadmin4
      ```
      This will add pgadmin's container (named _pgadmin4_) to the postgres container's network.

   1. Create a new network and add containers. If your preference is to leave the containers in tact, you may want to create a new bridge network and then connect the containers to it. Below we call this network `pg-net`, but it could be named whichever:

      ```bash
      docker network create  pg-net
      docker network connect pg-net pgadmin4
      docker network connect pg-net sequelize-postgres-10
      ```

   Once the two containers have been bridged, it's time to test out pgadmin:
      1. Visit `localhost:8888` in the browser and use the email and password set in the command above; `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD`, respectively.
      1. Inside pgadmin, use the following credentials to create a new server:
         ```yaml
         Host name: sequelize-postgres-10
         Port: 5432
         Username/Password: sequelize_test
         ```
         Notice: the host can use the container name instead of an IP; if bridged on the pgadmin network, it may require the IP of the database container (found in `docker network inspect <network name>`).

   

1. Running PgAdmin4 as a standalone client (non-containerized) for instance on Windows -> PostgreSQL on WSL2  
Note: these settings are for the PgAdmin desktop client, not using
   ```yaml
   Host: localhost
   Port: 23010 (or whichever port revealed by `docker ps -a`)
   Username: sequelize_test
   Password: sequelize_test
   ```
---

## Helpful Notes and Explanations
1. Most scripts in _package.json_ use `yarn`, which is not a package.json dependency and must installed globally or available by some other means; for instance, it does not need to be specifically installed. Read on:
   1. Node v14.19.0+ and Node v16.9.0+ come with [`corepack`](https://github.com/nodejs/corepack), which includes `yarn` and `pnpm`. `corepack` isn't enabled by default and must be explicitly included:
      ```bash
      corepack enable
      ```
      Enabling corepack allows you to use `yarn` w/o ever having to directly install it via `npm`, globally or locally.  

   1. `corepack` is available for older versions of Node via `npm`.  Install it globally; however, first remove existing installations of `yarn` and `pnpm`:
      ```bash
      npm uninstall -g yarn pnpm
      npm install -g corepack
      ``` 
   1. `yarn` can also be installed without `corepack` -- buy why would you? For completeness, this is still an option:
      ```bash
      npm install -g yarn  # global
      npm install yarn     # local
      ```
      - local installs of `yarn` require calling it with `npx` (e.g., `npx yarn start-postgres`) or customizing your environment. Because the package.json scripts would need updating, it's not advised to install the local version  


1. `yarn` has several advantages over `npm`. One relatively trivial advantage is it doesn't require the `run` statement to execute a script, which over time this can be cumbersome to include.  Consider the differences:

   NPM | YARN
   --- | ---
   `npm run test-integration` | `yarn test-integration`
   `npm run start-postgres` | `yarn start-postgres`
   ... 


1. Why don't the tests automatically spin up the database to test against?

   There is nothing that would prevent for a more intelligent or robust script to optionally automate some of this for the developer, but there are some valid reasons why effort has not been put into it to this point: 
   - The same test script is used locally and for the CI/CD, which starts their databases differently
   - If the scripts start the database automatically, it should stop it automatically, which can both take a while
   - The expected behavior is to start a database and run the tests multiple times when developing, then stop the database after

1. How does one use `node --inspect` to place a breakpoint in for development?
   - This requires patching the test script to enable node debugger.  There are no opinions against this, just that it hasn't been implemented. `console.log` is used for debugging

---

If you've discovered a mistake or found this cheatsheet useful feel free to contact @mike-usa.

- Special thanks to @ephys (Zoé) for being so gracious in fielding questions that led to the above and for supplying much of the content and answers 
- Special thanks to Nam Ding (on Slack) for the assistance in clarifying how docker/pgadmin4 is expected to behave
 