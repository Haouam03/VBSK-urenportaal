#!/bin/bash
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")"
echo "🥊 VBSK Urenregistratie wordt gestart..."
echo ""
echo "De browser opent automatisch zodra de server klaar is."
echo "Sluit dit venster om de server te stoppen."
echo ""

# Start server in background
npm run dev &
SERVER_PID=$!

# Wait for server to be ready
until curl -s -o /dev/null http://localhost:3000 2>/dev/null; do
  sleep 1
done

# Open browser
open http://localhost:3000

# Wait for server process
wait $SERVER_PID
