[![Build](https://travis-ci.org/cbandy/travis-oracle.svg?branch=master)](https://travis-ci.org/cbandy/travis-oracle)

Use [Oracle Database Express Edition][] in your builds on [Travis CI][].

[Oracle Database Express Edition]: http://www.oracle.com/technetwork/database/database-technologies/express-edition/overview/index.html
[Travis CI]: https://travis-ci.org/


Usage
-----

To use this tool, you must have an Oracle account with which you have accepted
the current license agreement for [Oracle Database Express Edition][].

1. Add your Oracle username and password to your build [environment variables][],
   either as hidden repository settings or secure variables:

   | Variable Name              | Value         |
   | -------------------------- | ------------- |
   | `ORACLE_LOGIN_ssousername` | your username |
   | `ORACLE_LOGIN_password`    | your password |

2. Add the version information to your build environment variables:

   ```yaml
   - ORACLE_FILE=oracle-xe-11.2.0-1.0.x86_64.rpm.zip
   - ORACLE_HOME=/u01/app/oracle/product/11.2.0/xe
   - ORACLE_SID=XE
   ```

3. Download and extract the [latest release][] into your project. For example,

   ```shell
   wget 'https://github.com/cbandy/travis-oracle/archive/v1.1.0.tar.gz'
   mkdir -p .travis/oracle
   tar --extract --gzip --strip-components 1 --directory .travis/oracle --file v1.1.0.tar.gz
   ```

4. Enable [`sudo`](http://docs.travis-ci.com/user/workers/standard-infrastructure):

   ```yaml
   sudo: required
   ```

5. Finally, execute the extracted scripts as part of your build, usually
   during [`before_install`](http://docs.travis-ci.com/user/build-lifecycle):

   ```yaml
   - .travis/oracle/download.sh
   - .travis/oracle/install.sh
   ```

[SQL\*Plus][] is installed to `$ORACLE_HOME/bin/sqlplus`, and the current user
has both normal and DBA access without a password, i.e. `/` and `/ AS SYSDBA`.

[environment variables]: http://docs.travis-ci.com/user/environment-variables
[latest release]: https://github.com/cbandy/travis-oracle/releases/latest
[SQL\*Plus]: http://www.oracle.com/pls/topic/lookup?ctx=xe112&id=SQPUG
