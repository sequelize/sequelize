
Set-Service sqlbrowser -StartupType auto
Start-Service sqlbrowser

[reflection.assembly]::LoadWithPartialName("Microsoft.SqlServer.Smo") | Out-Null
[reflection.assembly]::LoadWithPartialName("Microsoft.SqlServer.SqlWmiManagement") | Out-Null

$serverName = $env:COMPUTERNAME
$instanceName = 'SQL2017'
$smo = 'Microsoft.SqlServer.Management.Smo.'
$wmi = new-object ($smo + 'Wmi.ManagedComputer')

# Enable TCP/IP
$uri = "ManagedComputer[@Name='$serverName']/ServerInstance[@Name='$instanceName']/ServerProtocol[@Name='Tcp']"
$Tcp = $wmi.GetSmoObject($uri)
$Tcp.IsEnabled = $true
$TCP.alter()

Start-Service "MSSQL`$$instanceName"

$ipall = $wmi.GetSmoObject("ManagedComputer[@Name='$serverName']/ServerInstance[@Name='$instanceName']/ServerProtocol[@Name='Tcp']/IPAddress[@Name='IPAll']")
$port = $ipall.IPAddressProperties.Item("TcpPort").Value

$config = @{
  host = "localhost"
  username = "sa"
  password = "Password12!"
  port = $port
  database = "sequelize_test"
  dialectOptions = @{
    options = @{
      requestTimeout = 25000
      cryptoCredentialsDetails = @{
        ciphers = "RC4-MD5"
      }
    }
  }
  pool = @{
    max = 5
    idle = 3000
  }
}

$json = $config | ConvertTo-Json -Depth 3

# Create sequelize_test database
sqlcmd -S "(local)" -U "sa" -P "Password12!" -d "master" -Q "CREATE DATABASE [sequelize_test]; ALTER DATABASE [sequelize_test] SET READ_COMMITTED_SNAPSHOT ON;"

# cannot use Out-File because it outputs a BOM
[IO.File]::WriteAllLines((Join-Path $pwd "test\config\mssql.json"), $json)
