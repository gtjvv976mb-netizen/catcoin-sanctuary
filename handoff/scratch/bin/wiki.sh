#!/bin/bash
# usage: wiki.sh "Title" regex
t=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1")
sleep 1
curl -sS -m 30 -A "CatResearch/1.0 (research; contact none)" "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=$t&format=json&redirects=1" | python3 -c "
import sys,json,re
b=sys.stdin.read()
try: d=json.loads(b)
except Exception: print('ERR',b[:200]); sys.exit()
p=list(d['query']['pages'].values())[0]; t=p.get('extract','')
print('## wiki',p.get('title'),'len',len(t))
for m in re.finditer(r'[^.\n]*\b('+sys.argv[1]+r')\b[^.\n]*[.\n]',t,re.I): print('-',m.group(0).strip()[:350])
" "$2"
