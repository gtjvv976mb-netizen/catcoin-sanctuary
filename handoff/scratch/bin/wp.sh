#!/bin/bash
# usage: wp.sh base term
base=$1; shift; q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$*")
curl -sS -m 30 -A "Mozilla/5.0" -L "$base/wp-json/wp/v2/posts?search=$q&per_page=30&_fields=date,link,title" | python3 -c "
import sys,json,html
b=sys.stdin.read()
try:
  d=json.loads(b)
  print('## WP',sys.argv[1],'search=',sys.argv[2],'->',len(d),'posts')
  for p in d: print(' ',p['date'][:10],p['link'],'|',html.unescape(p['title']['rendered'])[:120])
except Exception as e: print('ERR',e,b[:200])
" "$base" "$*"
