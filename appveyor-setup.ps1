
Set-Service sqlbrowser -StartupType auto
Start-Service sqlbrowser

[reflection.assembly]::LoadWithPartialName("Microsoft.SqlServer.Smo") | Out-Null
[reflection.assembly]::LoadWithPartialName("Microsoft.SqlServer.SqlWmiManagement") | Out-Null

$wmi = New-Object('Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer')
$tcp = $wmi.GetSmoObject("ManagedComputer[@Name='${env:computername}']/ServerInstance[@Name='SQL2016']/ServerProtocol[@Name='Tcp']")
$tcp.IsEnabled = $true
$tcp.Alter()

$wmi = New-Object('Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer')
$ipall = $wmi.GetSmoObject("ManagedComputer[@Name='${env:computername}']/ServerInstance[@Name='SQL2016']/ServerProtocol[@Name='Tcp']/IPAddress[@Name='IPAll']")
$port = $ipall.IPAddressProperties.Item("TcpDynamicPorts").Value

$config = @{
  instanceName = "SQL2016"
  host = "localhost"
  username = "sa"
  password = "Password12!"
  port = $port
  database = "sequelize_test"
  dialectOptions = @{
    requestTimeout = 25000
    cryptoCredentialsDetails = @{
      ciphers = "RC4-MD5"
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
