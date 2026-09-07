#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
nohup waitress-serve --host=127.0.0.1 --port=5000 app:app > flask.log 2>&1 &
echo $! > flask.pid
echo "✅ Flask started. PID: $(cat flask.pid)"
