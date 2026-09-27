#!/bin/bash
# READ-ONLY: lists what's in Desktop, Downloads and Documents so you can
# decide what to organize. Nothing is moved, changed or deleted.
# Results are saved to a text file on your Desktop and copied to your clipboard.

OUT="$HOME/Desktop/whats-on-my-mac.txt"
places=("Desktop" "Downloads" "Documents")

{
  echo "=== WHAT'S ON MY MAC ($(date '+%Y-%m-%d')) ==="
  for p in "${places[@]}"; do
    dir="$HOME/$p"
    [ -d "$dir" ] || continue
    echo
    echo "########## $p ##########"
    echo "Total files (including subfolders): $(find "$dir" -type f ! -name '.*' ! -name 'whats-on-my-mac.txt' 2>/dev/null | wc -l | tr -d ' ')"

    echo
    echo "-- File types (top 12) --"
    find "$dir" -type f ! -name '.*' ! -name 'whats-on-my-mac.txt' 2>/dev/null \
      | sed -n 's/.*\.\([A-Za-z0-9]*\)$/\1/p' | tr 'A-Z' 'a-z' \
      | sort | uniq -c | sort -rn | head -12

    echo
    echo "-- Items sitting directly in $p (first 150) --"
    ls -1p "$dir" 2>/dev/null | grep -v -e '^\.' -e '^whats-on-my-mac.txt$' | head -150

    echo
    echo "-- Biggest files (top 10) --"
    find "$dir" -type f ! -name '.*' ! -name 'whats-on-my-mac.txt' -size +20M -exec du -h {} + 2>/dev/null \
      | sort -rh | head -10 | sed "s|$HOME/||"
  done
} > "$OUT"

pbcopy < "$OUT" 2>/dev/null
echo "Done. Saved to: $OUT"
echo "It's also copied to your clipboard. Paste it into the chat with Claude."
