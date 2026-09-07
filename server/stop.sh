#!/bin/bash
# Stop the Flask server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/flask.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✅ Flask process $PID stopped."
        rm "$PID_FILE"
    else
        echo "⚠️  PID file exists but process not running. Removing stale PID file."
        rm "$PID_FILE"
    fi
else
    # Try to kill by process name as fallback
    pkill -f "waitress-serve" && echo "✅ Flask stopped (by name)." || echo "ℹ️  Flask was not running."
fi
