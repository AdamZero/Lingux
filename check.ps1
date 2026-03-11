# check-docker-readiness-ascii.ps1
Write-Host "[INFO] Checking Docker readiness..." -ForegroundColor Cyan
Write-Host "--------------------------------------------------"

# Check CPU Virtualization
$cpuVirt = (Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
if ($cpuVirt) {
    Write-Host "[OK] CPU Virtualization is enabled in BIOS" -ForegroundColor Green
} else {
    Write-Host "[ERROR] CPU Virtualization is NOT enabled. Enable VT-x/AMD-V in BIOS." -ForegroundColor Red
}

# Check Virtual Machine Platform
try {
    $vmp = (Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction Stop).State -eq "Enabled"
    if ($vmp) {
        Write-Host "[OK] Virtual Machine Platform is enabled" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Virtual Machine Platform is not enabled. Run:" -ForegroundColor Yellow
        Write-Host "      dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart"
    }
} catch {
    Write-Host "[ERROR] Failed to check Windows features. Please run PowerShell as Administrator." -ForegroundColor Red
}

# Check WSL
if (Get-Command wsl -ErrorAction SilentlyContinue) {
    $status = wsl --status 2>&1 | Out-String
    if ($status -match "Default Version:\s*2") {
        Write-Host "[OK] WSL is installed and default version is 2" -ForegroundColor Green
    } else {
        Write-Host "[WARN] WSL default version is not 2. Run:" -ForegroundColor Yellow
        Write-Host "      wsl --set-default-version 2"
    }
} else {
    Write-Host "[ERROR] WSL is not installed. Install from: https://aka.ms/wsl2kernel" -ForegroundColor Red
}

Write-Host "--------------------------------------------------"
Write-Host "[DONE] Check complete. Fix any [ERROR] items to use Docker Desktop." -ForegroundColor Cyan