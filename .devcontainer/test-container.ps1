# Test Dev Container configuration script
Write-Host "Testing Dev Container configuration..." -ForegroundColor Green

# Check if image exists
Write-Host "Checking Docker image..." -ForegroundColor Yellow
$image = docker images | Select-String "zishu-sensei-zishu-api"
if ($image) {
    Write-Host "Image exists: $image" -ForegroundColor Green
}
else {
    Write-Host "Image not found" -ForegroundColor Red
    exit 1
}

# Check configuration file syntax
Write-Host "Checking devcontainer.json syntax..." -ForegroundColor Yellow
try {
    $config = Get-Content ".devcontainer/devcontainer.json" | ConvertFrom-Json
    Write-Host "devcontainer.json syntax is valid" -ForegroundColor Green
}
catch {
    Write-Host "devcontainer.json syntax error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Display configuration summary
Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "  Image: $($config.image)" -ForegroundColor White
Write-Host "  Workspace: $($config.workspaceFolder)" -ForegroundColor White
Write-Host "  Forward Ports: $($config.forwardPorts -join ', ')" -ForegroundColor White

Write-Host "Dev Container configuration test completed successfully!" -ForegroundColor Green
Write-Host "You can now use 'Dev Containers: Reopen in Container' command in VS Code." -ForegroundColor Cyan