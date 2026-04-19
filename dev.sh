#!/bin/bash
# Dev server launcher — ensures Node is on PATH for preview_start.
export PATH="/Users/andrewdegood/Desktop/Claude/tools/node/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev
