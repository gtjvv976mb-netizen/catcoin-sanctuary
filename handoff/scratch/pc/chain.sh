cd "$(dirname "$0")"
while ps -eo args | grep -q "^node clips.mjs orbit"; do sleep 10; done
for c in adopt cats research; do Q=medium timeout 7200 node clips.mjs $c > clip-$c.log 2>&1; echo done >> clip-$c.log; done
