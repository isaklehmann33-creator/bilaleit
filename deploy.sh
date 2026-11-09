#!/bin/sh
# Setur síðuna í loftið og merkir nýja útgáfu, svo opnar síður sæki hana sjálfar.
set -e
cd "$(dirname "$0")"
V=$(date +%s)
echo "{\"v\":\"$V\"}" > public/version.json
sed -i '' "s/window.APP_VERSION = '[0-9]*'/window.APP_VERSION = '$V'/" public/firebase-config.js
npx -y firebase-tools@13.29.1 deploy --only hosting,firestore:rules --non-interactive
