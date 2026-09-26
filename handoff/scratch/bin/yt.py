#!/usr/bin/env python3
import sys,re,json,subprocess,urllib.parse
q=" ".join(sys.argv[1:])
h=subprocess.run(["curl","-sS","-m","25","-A","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36","-H","Accept-Language: en-US","https://www.youtube.com/results?search_query="+urllib.parse.quote_plus(q)],capture_output=True).stdout.decode('utf-8','replace')
m=re.search(r'var ytInitialData = (\{.*?\});</script>',h)
print("## yt:",q)
if not m: print("no data", len(h)); sys.exit()
d=json.loads(m.group(1))
def walk(o):
    if isinstance(o,dict):
        if 'videoRenderer' in o:
            v=o['videoRenderer']
            t=''.join(r.get('text','') for r in v.get('title',{}).get('runs',[]))
            ch=''.join(r.get('text','') for r in v.get('ownerText',{}).get('runs',[]))
            pub=v.get('publishedTimeText',{}).get('simpleText','')
            print('-',v['videoId'],'|',t,'|',ch,'|',pub)
        for x in o.values(): walk(x)
    elif isinstance(o,list):
        for x in o: walk(x)
walk(d)
