#!/bin/sh
# Once a day, copy GitHub's repo traffic (views and clones per day, the top referrers) into the website's
# stats database, because GitHub keeps only 14 days. It reads with the owner's own `gh` login: no token is
# made or stored. The ingest key is in .ingest-key.txt (git-ignored) and reaches curl on stdin, never argv.
#   sh tools/gh-traffic.sh           copy once now
#   sh tools/gh-traffic.sh install   copy every day at 10:00 with launchd (once the repo is public)
set -eu
cd "$(dirname "$0")/.."
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
REPO=${REPO:-morningverse67-wq/carryon-app}
URL=${URL:-https://carryon-app.pages.dev/api/gh-traffic}
LABEL=com.morningverse.carryon-gh-traffic

if [ "${1:-}" = install ]; then
  plist="$HOME/Library/LaunchAgents/$LABEL.plist"
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$LABEL</string>
<key>ProgramArguments</key><array><string>/bin/sh</string><string>$PWD/tools/gh-traffic.sh</string></array>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
<key>StandardOutPath</key><string>$HOME/Library/Logs/carryon-gh-traffic.log</string>
<key>StandardErrorPath</key><string>$HOME/Library/Logs/carryon-gh-traffic.log</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "installed $plist (log: ~/Library/Logs/carryon-gh-traffic.log)"
  exit 0
fi

views=$(gh api "repos/$REPO/traffic/views")
clones=$(gh api "repos/$REPO/traffic/clones")
refs=$(gh api "repos/$REPO/traffic/popular/referrers")
key=$(cat .ingest-key.txt)
printf '{"k":"%s","views":%s,"clones":%s,"referrers":%s}' "$key" "$views" "$clones" "$refs" |
  curl -fsS --max-time 30 -H 'Content-Type: application/json' --data-binary @- "$URL"
echo " $(date '+%F %T')"
