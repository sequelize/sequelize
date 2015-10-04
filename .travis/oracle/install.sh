#!/bin/sh -e

ORACLE_RPM=`basename $ORACLE_FILE .zip`

cd "$(dirname "$(readlink -f "$0")")"

sudo apt-get -qq update
sudo apt-get --no-install-recommends -qq install alien bc libaio1 unzip

df -B1 /dev/shm | awk 'END { if ($1 != "shmfs" && $1 != "tmpfs" || $2 < 2147483648) exit 1 }' ||
  ( sudo rm -r /dev/shm && sudo mkdir /dev/shm && sudo mount -t tmpfs shmfs -o size=2G /dev/shm )

test -f /sbin/chkconfig ||
  ( echo '#!/bin/sh' | sudo tee /sbin/chkconfig > /dev/null && sudo chmod u+x /sbin/chkconfig )

test -d /var/lock/subsys || sudo mkdir /var/lock/subsys

unzip -j "$ORACLE_FILE" "*/$ORACLE_RPM"
sudo dpkg --install `sudo alien --scripts --to-deb "$ORACLE_RPM" | cut -d' ' -f1`

echo 'OS_AUTHENT_PREFIX=""' | sudo tee -a "$ORACLE_HOME/config/scripts/init.ora" > /dev/null
sudo usermod -aG dba $USER

( echo ; echo ; echo travis ; echo travis ; echo n ) | sudo AWK='/usr/bin/awk' /etc/init.d/oracle-xe configure

"$ORACLE_HOME/bin/sqlplus" -L -S / AS SYSDBA <<SQL
CREATE USER $USER IDENTIFIED EXTERNALLY;
GRANT CONNECT, RESOURCE TO $USER;
SQL
