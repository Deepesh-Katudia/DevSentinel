# Starts the DevSentinel API using the project venv interpreter.
# The global Python env is polluted with conflicting deps from other tools
# (starlette/uvicorn versions that break fastapi 0.115.0), so we MUST run
# through .venv. This script hardcodes the venv python so `python` on PATH
# can never be picked up by accident.
$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Error "venv not found at $venvPython. Create it and install deps: python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
    exit 1
}

& $venvPython -c "import sys; print('Using interpreter:', sys.executable)"
& $venvPython -m uvicorn main:app --reload --port 8000
