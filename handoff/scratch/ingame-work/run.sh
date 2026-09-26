cd /home/user/catcoin-sanctuary
D=/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/ingame-work
for pass in 1 2; do
  todo=$(for k in $(cat $D/keys.txt); do [ -f assets/ingame/$k.jpg ] || echo $k; done)
  echo "pass $pass: $(echo $todo | wc -w) to do"
  echo $todo | xargs -n 25 node scripts/capture-ingame.mjs
done
