#!/bin/bash

# Watch logs script for YouTube indexing system
echo "🔍 Watching logs for YouTube indexing system..."
echo "Press Ctrl+C to stop"
echo ""

# Function to colorize log output
colorize_logs() {
  while IFS= read -r line; do
    if [[ $line == *"[TRANSCRIPT]"* ]]; then
      echo -e "\033[36m$line\033[0m"  # Cyan for transcript logs
    elif [[ $line == *"[VIDEOS]"* ]]; then
      echo -e "\033[33m$line\033[0m"  # Yellow for video logs
    elif [[ $line == *"[CHAT]"* ]]; then
      echo -e "\033[32m$line\033[0m"  # Green for chat logs
    elif [[ $line == *"[ERROR]"* ]] || [[ $line == *"❌"* ]]; then
      echo -e "\033[31m$line\033[0m"  # Red for errors
    elif [[ $line == *"[WARN]"* ]] || [[ $line == *"⚠️"* ]]; then
      echo -e "\033[33m$line\033[0m"  # Yellow for warnings
    else
      echo "$line"
    fi
  done
}

# Start the development server and watch logs
bun run dev 2>&1 | colorize_logs
