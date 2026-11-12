# CarryOn for Windows installer (the zip; the app is also on the Microsoft Store):  irm https://carryon-app.pages.dev/install.ps1 | iex
# Downloads the release zip from GitHub, checks its SHA-256, installs to %LOCALAPPDATA%\CarryOn,
# adds a Start menu shortcut and starts CarryOn in the tray. A file PowerShell downloads has no
# "from the internet" mark, so Windows does not show the SmartScreen prompt for it.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
  $tag = 'v1.8.1'
  $zip = 'CarryOn-windows-x64-1.8.1-beta.zip'
  $sha = '64802f0a4a72d5cfa72e085aa9bddcf8badd6ccdc1b56b25afb55d6a9963312d'
  $url = "https://github.com/morningverse67-wq/carryon-app/releases/download/$tag/$zip"
  $dir = Join-Path $env:LOCALAPPDATA 'CarryOn'
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('carryon-' + [guid]::NewGuid())
  New-Item -ItemType Directory $tmp | Out-Null
  try {
    Write-Host "Downloading CarryOn $tag ..."
    Invoke-WebRequest $url -OutFile (Join-Path $tmp $zip) -UseBasicParsing -UserAgent 'CarryOn-install (Windows)'
    $got = (Get-FileHash (Join-Path $tmp $zip) -Algorithm SHA256).Hash.ToLower()
    if ($got -ne $sha) { throw "The download does not match its checksum ($got). Nothing was installed." }
    Get-Process CarryOn -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force
    Start-Sleep -Milliseconds 800
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Expand-Archive (Join-Path $tmp $zip) $dir -Force
    $lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'CarryOn.lnk'
    $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
    $s.TargetPath = Join-Path $dir 'CarryOn.exe'
    $s.WorkingDirectory = $dir
    $s.Save()
    Start-Process (Join-Path $dir 'CarryOn.exe')
    Write-Host "CarryOn is installed in $dir and running in the tray (bottom right)."
    Write-Host 'To remove it: quit CarryOn from the tray, then delete that folder and the CarryOn Start menu shortcut.'
  } finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
