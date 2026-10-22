#!/bin/bash
# Build the Elementor bundle from the mockup and deploy it to the staging site.
# Usage: tools/wp/deploy.sh
# Needs: SSH host alias "claymedia-staging" (~/.ssh/config) and node-html-parser on NODE_PATH.
set -euo pipefail
cd "$(dirname "$0")/../.."

HOST=claymedia-staging
SITE=public_html/shastamountainguides
BUNDLE=$(mktemp -t smg-bundle).json

# The host's SSH sits behind a load balancer; a node occasionally refuses the key. Retry those.
retry() {
  for i in 1 2 3 4 5 6; do
    if out=$("$@" 2>&1); then echo "$out"; return 0; fi
    if ! grep -q "Permission denied (publickey\|unexpected end of file\|Connection reset" <<<"$out"; then echo "$out" >&2; return 1; fi
    sleep 5
  done
  echo "$out" >&2; return 1
}

node tools/wp/build-site.js "$BUNDLE"
retry rsync -az -e 'ssh -o BatchMode=yes' "$BUNDLE" tools/wp/deploy.php "$HOST:shasta-import/" >/dev/null
retry rsync -az -e 'ssh -o BatchMode=yes' "$BUNDLE" "$HOST:shasta-import/bundle.json" >/dev/null

local_sum=$(shasum -a 256 "$BUNDLE" | cut -d' ' -f1)
remote_sum=$(retry ssh -o BatchMode=yes "$HOST" 'sha256sum shasta-import/bundle.json' | cut -d' ' -f1)
if [ "$local_sum" != "$remote_sum" ]; then echo "Upload checksum mismatch; not deploying." >&2; exit 1; fi

retry ssh -o BatchMode=yes "$HOST" "cd $SITE && wp eval-file ~/shasta-import/deploy.php ~/shasta-import/bundle.json --user=admin 2>&1 | grep -v Deprecated | tail -1"
# Best effort: StackCache sometimes ignores purges from SSH. If pages still look stale, click "Purge Cache" in the WP admin bar.
retry ssh -o BatchMode=yes "$HOST" "cd $SITE && wp eval 'if ( class_exists(\"WPStackCache\") ) { WPStackCache::purge(\"all\"); echo \"StackCache purge requested\"; }' 2>/dev/null" || true
rm -f "$BUNDLE"
