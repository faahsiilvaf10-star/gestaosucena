$ErrorActionPreference = 'Stop'
$version = "v44.4.1"
$zipUrl = "https://github.com/electron/electron/releases/download/$version/electron-$version-win32-x64.zip"
$outDir = "dist-release"
$tempDir = "$outDir\GestaoSucena-Temp"
$finalZip = "$outDir\GestaoSucena-1.0.0-win.zip"
$electronZip = "$outDir\electron.zip"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

if (-not (Test-Path $electronZip)) {
    Write-Host "Baixando binarios do Electron..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $electronZip
}

Write-Host "Extraindo binários..."
Expand-Archive -Path $electronZip -DestinationPath $tempDir -Force

Write-Host "Copiando arquivos do App..."
$appDir = "$tempDir\resources\app"
New-Item -ItemType Directory -Path $appDir | Out-Null
Copy-Item "index.js" -Destination $appDir
Copy-Item "package.json" -Destination $appDir

Write-Host "Renomeando executável..."
Rename-Item "$tempDir\electron.exe" "GestaoSucena.exe"

if (Test-Path $finalZip) {
    Remove-Item $finalZip -Force
}

Write-Host "Compactando aplicativo final ($finalZip)..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $finalZip -Force

Write-Host "Limpando temporarios..."
Remove-Item $tempDir -Recurse -Force

Write-Host "PRONTO! Arquivo gerado em $finalZip"
