#!/bin/bash
# mk.sh TICKER... : make models, and redo any over budget with smaller si/q
cd /home/user/cat-sanctuary
G=/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/node_modules/.bin/gltfpack
python3 scripts/make-cat-models.py --gltfpack $G "$@" > /tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3/mk.log 2>&1
for pass in 1 2; do
O=$(grep -oE "! [A-Za-z0-9-]+\.glb is" /tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3/mk.log | sed 's/! //;s/\.glb is//' | sed 's/-lo$//' | sort -u)
[ -z "$O" ] && break
python3 - $pass $O <<'P'
import json,sys
J='scripts/cat-models.jobs.json'; d=json.load(open(J)); p=int(sys.argv[1])
for k in sys.argv[2:]:
    d[k]['si']=round(d[k].get('si',0.03)*0.8,4); d[k]['q']=max(56,d[k].get('q',70)-6)
    if p==2: d[k]['sa_lo']=True
json.dump(d,open(J,'w'),indent=1); open(J,'a').write('\n')
P
python3 scripts/make-cat-models.py --gltfpack $G $O > /tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3/mk.log 2>&1
done
grep -E "!" /tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3/mk.log || echo all-under-budget
