#!/usr/bin/env python3
import sys,subprocess,urllib.parse,xml.etree.ElementTree as ET
n=int(sys.argv[1]); 
for q in sys.argv[2:]:
    x=subprocess.run(["curl","-sS","-m","25","-A","Mozilla/5.0","https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q="+urllib.parse.quote_plus(q)],capture_output=True).stdout.decode('utf-8','replace')
    try:
        r=ET.fromstring(x); items=[(i.findtext('title'),i.findtext('link'),i.findtext('pubDate')) for i in r.iter('item')]
    except Exception as e:
        print('ERR',q,x[:200]); continue
    print(f"## gnews: {q} ({len(items)})")
    for t,l,d in items[:n]:
        print(f"- {t} | {d[5:16] if d else ''} | {l.split('/articles/')[1][:60] if '/articles/' in l else l}")
    print()
