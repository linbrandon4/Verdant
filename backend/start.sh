#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -x ".venv/bin/python" ]]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
  ./.venv/bin/pip install -r requirements.txt
fi

if [[ ! -f ".env" ]]; then
  echo "Missing .env — copy .env.example to .env and add your GEMINI_API_KEY."
  exit 1
fi

# Avoid pydantic plugin scan timeouts when the project lives on iCloud Desktop.
export PYDANTIC_DISABLE_PLUGINS=1

echo "Starting backend at http://127.0.0.1:8000"
exec ./.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
