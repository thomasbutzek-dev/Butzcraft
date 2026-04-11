$port = 3002
$url = "http://localhost:$port/"
$savesDir = Join-Path $PSScriptRoot "saves"

if (-not (Test-Path $savesDir)) {
    New-Item -ItemType Directory -Path $savesDir | Out-Null
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host "Butzcraft-Server läuft auf $url" -ForegroundColor Green
Write-Host "Drücke Strg+C zum Beenden."

function Send-Response($context, $content, $contentType = "text/plain", $statusCode = 200) {
    if ($content -is [string]) {
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($content)
    } else {
        $buffer = $content
    }
    $context.Response.StatusCode = $statusCode
    $context.Response.ContentType = $contentType
    $context.Response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    $context.Response.ContentLength64 = $buffer.Length
    $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $context.Response.Close()
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $path = $request.Url.LocalPath

        # API: Liste der Spielstände
        if ($path -eq "/api/saves" -and $request.HttpMethod -eq "GET") {
            $files = Get-ChildItem -Path $savesDir -Filter *.json | Select-Object -ExpandProperty Name
            $names = $files | ForEach-Object { $_.Substring(0, $_.Length - 5) }
            $json = ConvertTo-Json @($names)
            Send-Response $context $json "application/json"
            continue
        }

        # API: Spielstand laden
        if ($path -eq "/api/load" -and $request.HttpMethod -eq "GET") {
            $name = $request.QueryString["name"]
            $filePath = Join-Path $savesDir "$name.json"
            if (Test-Path $filePath) {
                $data = Get-Content -Raw -Path $filePath
                Send-Response $context $data "application/json"
            } else {
                Send-Response $context '{"error":"Nicht gefunden"}' "application/json" 404
            }
            continue
        }

        # API: Spielstand speichern
        if ($path -eq "/api/save" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $data = $body | ConvertFrom-Json
            
            $name = $data.name
            $filePath = Join-Path $savesDir "$name.json"
            $data.gameData | ConvertTo-Json -Depth 10 | Set-Content -Path $filePath
            
            Send-Response $context '{"success":true}' "application/json"
            continue
        }

        # API: AutoTester Logging
        if ($path -eq "/api/tester/log" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $logData = $body | ConvertFrom-Json
            
            $logDir = Join-Path $PSScriptRoot "js\tester"
            if (-not (Test-Path $logDir)) {
                New-Item -ItemType Directory -Path $logDir | Out-Null
            }
            $logFile = Join-Path $logDir "protokoll.log"
            
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $type = $logData.type
            $msg = $logData.message
            $logLine = "[$timestamp] [$type] $msg"
            
            Add-Content -Path $logFile -Value $logLine
            
            Send-Response $context '{"success":true}' "application/json"
            continue
        }

        # Statische Dateien
        $fileName = if ($path -eq "/") { "index.html" } else { $path.TrimStart("/") }
        $localFile = Join-Path $PSScriptRoot $fileName

        if (Test-Path $localFile -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html" }
                ".js"   { "text/javascript" }
                ".css"  { "text/css" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".webp" { "image/webp" }
                ".ogg"  { "audio/ogg" }
                default { "application/octet-stream" }
            }
            $content = [System.IO.File]::ReadAllBytes($localFile)
            Send-Response $context $content $mime
        } else {
            Send-Response $context "404 Not Found" "text/plain" 404
        }
    }
} finally {
    $listener.Stop()
}
