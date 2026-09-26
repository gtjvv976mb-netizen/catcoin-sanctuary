#!/bin/bash
# usage: rp.sh i=url ...   (registers then packs, serialized with a lock)
S=/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad
(
flock 9
cd $S; T=$(python3 regq.py "$@")
cd /home/user/cat-sanctuary; python3 $S/pack.py $T
) 9>$S/.lock >> $S/pack2.log 2>&1
