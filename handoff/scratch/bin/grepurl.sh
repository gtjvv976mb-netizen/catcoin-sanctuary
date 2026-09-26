#!/bin/bash
# usage: grepurl.sh url regex
curl -sS -m 30 -A "Mozilla/5.0" -L "$1" | python3 -c "
import sys,re,html
t=sys.stdin.read()
t=re.sub(r'(?s)<script.*?</script>|<style.*?</style>','',t)
t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
print('## len',len(t))
for m in re.finditer(sys.argv[1],t,re.I):
  s=max(0,m.start()-220); print('...',t[s:m.end()+220],'...\n')
" "$2"
