cd "$(dirname "$0")"
while ps -eo args | grep -q "^node clips.mjs"; do sleep 10; done
sleep 15
while ps -eo args | grep -q "^node clips.mjs"; do sleep 10; done
timeout 7200 node clips.mjs adopt > clip-adopt.log 2>&1; echo done >> clip-adopt.log
