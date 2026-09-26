cd /tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3
for r in $(seq 1 40); do
  python3 poll3d.py 114450 115830 >> loop.log 2>&1
  n=$(python3 -c "
import json;j=json.load(open('jobs.json'))
print(sum(1 for i in list(range(15000,15024))+list(range(16000,16065)) if str(i) in j and 'url:'+j[str(i)] not in j))")
  echo "round $r pending $n" >> loop.log
  [ "$n" = "0" ] && break
  sleep 90
done
echo done >> loop.log
