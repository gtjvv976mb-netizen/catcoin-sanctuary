#!/usr/bin/env python3
import sys,re,json,subprocess,urllib.parse
def curl(args):
    return subprocess.run(["curl","-sS","-m","25","-A","Mozilla/5.0"]+args,capture_output=True).stdout.decode('utf-8','replace')
def decode(link):
    aid=link.split('/articles/')[1].split('?')[0]
    h=curl(["-L","https://news.google.com/rss/articles/"+aid+"?oc=5&hl=en-US&gl=US&ceid=US:en"])
    sg=re.search(r'data-n-a-sg="([^"]+)"',h); ts=re.search(r'data-n-a-ts="([^"]+)"',h)
    if not sg: return 'NO-SG'
    req=[[["Fbv4je",json.dumps(["garturlreq",[["X","X",["X","X"],None,None,1,1,"US:en",None,1,None,None,None,None,None,0,1],"X","X",1,[1,1,1],1,1,None,0,0,None,0],aid,int(ts.group(1)),sg.group(1)]),None,"generic"]]]
    body="f.req="+urllib.parse.quote(json.dumps(req))
    r=curl(["-X","POST","-H","Content-Type: application/x-www-form-urlencoded;charset=UTF-8","--data",body,"https://news.google.com/_/DotsSplashUi/data/batchexecute"])
    m=re.search(r'\[\\"garturlres\\",\\"(.*?)\\"',r)
    return m.group(1) if m else 'FAIL:'+r[:200]
for l in sys.argv[1:]: print(decode(l))
