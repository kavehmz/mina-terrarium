#!/bin/sh
# Run a capture scenario in the Playwright image, on the same network as the Terrarium.
# ./run.sh <scenario.json> <output folder>
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=$(mkdir -p "$2" && cd "$2" && pwd)
docker run --rm --network terrarium_default -v "$here:/work" -v "$out:/out" -w /tmp \
  mcr.microsoft.com/playwright:v1.55.0-noble \
  sh -c "npm i --silent --no-audit --no-fund playwright@1.55.0 >/dev/null 2>&1 && cp /work/shoot.mjs . && node shoot.mjs /work/$(basename "$1") /out"
