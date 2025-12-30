$ErrorActionPreference = "Stop"

try {
    Write-Host "Step 1: Running 'npm run build' to compile the plugin..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Step 1 failed: 'npm run build' exited with code $LASTEXITCODE."
    }
    Write-Host "=> Build completed successfully (`main.js` generated)."

    Write-Host "Step 2: Ensuring 'auto-git-sync' directory exists and moving main.js..."

    if (-not(Test-Path -Path "auto-git-sync" -PathType Container)) {
        New-Item -Path "auto-git-sync" -ItemType Directory | Out-Null
        Write-Host "    Create 'auto-git-sync' directory."
    } else {
        Write-Host "    'auto-git-sync' directory already exists."
    }

    Move-Item -Path "main.js" -Destination "auto-git-sync\main.js" -Force
    Write-Host "    Move 'main.js' to 'auto-git-sync' directory."

    Write-Host "Step 3: Copying manifest.json and style.css to 'build' directory (if they exist)..."
    if (Test-Path -Path "manifest.json") {
        Copy-Item -Path "manifest.json" -Destination "auto-git-sync\manifest.json" -Force
        Write-Host "    Copied 'manifest.json' to 'auto-git-sync' directory."
    } else {
        Write-Host "    'manifest.json' not found."
    }

    if (Test-Path -Path "styles.css") {
        Copy-Item -Path "styles.css" -Destination "auto-git-sync\styles.css" -Force
        Write-Host "    Copied 'styles.css' to 'auto-git-sync' directory."
    } else {
        Write-Host "    'styles.css' not found."
    }

    Write-Host "All steps completed successfully. Plugin build artifact is ready in 'auto-git-sync' directory."
}
catch {
    Write-Error "Build failed: $_"
    exit 1
}