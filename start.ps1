$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPython = Join-Path $root "api\.venv\Scripts\python.exe"
$npm = (Get-Command npm.cmd).Source
$appUrl = "http://localhost:3000/chapters/1"

if (-not (Test-Path $apiPython)) {
    throw "Backend dependencies are missing. See README.md."
}

function Test-LocalPort {
    param([int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $result.AsyncWaitHandle.WaitOne(300)) {
            return $false
        }
        $client.EndConnect($result)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

if (-not (Test-LocalPort -Port 8000)) {
    Start-Process `
        -FilePath $apiPython `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory (Join-Path $root "api") `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $root "api-server.log") `
        -RedirectStandardError (Join-Path $root "api-server-error.log")
}

if (-not (Test-LocalPort -Port 3000)) {
    Start-Process `
        -FilePath $npm `
        -ArgumentList "run", "dev" `
        -WorkingDirectory (Join-Path $root "web") `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $root "web-server.log") `
        -RedirectStandardError (Join-Path $root "web-server-error.log")
}

for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if ((Test-LocalPort -Port 3000) -and (Test-LocalPort -Port 8000)) {
        Start-Process $appUrl
        exit 0
    }
    Start-Sleep -Milliseconds 500
}

throw "CPA study app startup timed out. See web-server-error.log."
