#!/bin/sh
# Setur síðuna í loftið. Opnar síður fá hana við endurhleðslu, eða strax ef stjórnandi ýtir á „Uppfæra allar opnar síður“.
set -e
cd "$(dirname "$0")"
V=$(date +%s)
echo "{\"v\":\"$V\"}" > public/version.json
sed -i '' "s/window.APP_VERSION = '[0-9]*'/window.APP_VERSION = '$V'/" public/firebase-config.js
npx -y firebase-tools@13.29.1 deploy --only hosting,firestore:rules --non-interactive
