#!/bin/sh
# CarryOn installer: curl -fsSL https://carryon-app.pages.dev/install.sh | sh
# Downloads the newest release's CarryOn.dmg, checks its SHA-256 against the release's SHA256SUMS.txt, quits a running
# CarryOn and puts CarryOn.app into /Applications. A file curl downloads carries no quarantine flag, so macOS opens the
# app without the "Open Anyway" step (CarryOn is not notarized). CARRYON_DEST=<folder> installs there instead and
# neither quits nor opens CarryOn. All of it is in main, called by the last line: a download cut short runs nothing.
set -eu

main() {
  REL=https://github.com/morningverse67-wq/carryon-app/releases/latest/download
  ID=io.github.carryon.app
  DEST=${CARRYON_DEST:-/Applications}
  DEST=${DEST%/}
  APP="$DEST/CarryOn.app"
  [ "$(uname -s)" = Darwin ] || { echo "CarryOn is a macOS app." >&2; exit 1; }
  if [ ! -d "$DEST" ] || [ ! -w "$DEST" ]; then
    echo "Can't write to $DEST. Run it from an administrator account, or make ~/Applications and run it with CARRYON_DEST=~/Applications." >&2
    exit 1
  fi
  tmp=$(mktemp -d)
  trap 'hdiutil detach -quiet -force "$tmp/mnt" 2>/dev/null || true; rm -rf "$tmp"' EXIT
  trap 'exit 130' INT TERM HUP
  echo "Downloading CarryOn…"
  # through the site's /download, which counts the download and sends it on to the release
  curl -fsSL -A "CarryOn-install (Macintosh)" https://carryon-app.pages.dev/download -o "$tmp/CarryOn.dmg"
  curl -fsSL "$REL/SHA256SUMS.txt" -o "$tmp/SHA256SUMS.txt"
  want=$(awk '$2 == "CarryOn.dmg" {print $1}' "$tmp/SHA256SUMS.txt")
  got=$(shasum -a 256 "$tmp/CarryOn.dmg" | awk '{print $1}')
  if [ -z "$want" ] || [ "$want" != "$got" ]; then
    echo "SHA-256 does not match the release: stopped, nothing installed. (If a new version just came out, run it again.)" >&2
    exit 1
  fi
  echo "SHA-256 OK: $got"
  hdiutil attach -quiet -nobrowse -readonly -mountpoint "$tmp/mnt" "$tmp/CarryOn.dmg"
  ditto "$tmp/mnt/CarryOn.app" "$tmp/CarryOn.app"  # whole, before the installed one goes
  if [ "$DEST" = /Applications ]; then
    osascript -e "if application id \"$ID\" is running then tell application id \"$ID\" to quit" >/dev/null 2>&1 || true
    n=0
    while [ "$(osascript -e "application id \"$ID\" is running" 2>/dev/null || echo false)" = true ]; do
      n=$((n + 1))
      if [ "$n" -gt 20 ]; then echo "CarryOn is still running: quit it from its menu, then run this again." >&2; exit 1; fi
      sleep 0.5
    done
  fi
  rm -rf "$APP"
  mv "$tmp/CarryOn.app" "$APP"
  echo "Installed $APP"
  if [ "$DEST" = /Applications ]; then open "$APP"; echo "CarryOn is in the menu bar."; fi
}

main "$@"
