import json,subprocess,urllib.parse,re,time,sys
G=json.loads(sys.argv[1])
def ext(t):
    for i in range(4):
        o=subprocess.run(['curl','-sS','-m','25','-A','CatSanctuaryResearch/1.0','https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles='+urllib.parse.quote(t)],capture_output=True,text=True).stdout
        if o.startswith('{'):
            p=list(json.loads(o)['query']['pages'].values())[0]; return p.get('title'),p.get('extract','')
        time.sleep(3)
    return None,''
for cid,(title,needle) in G.items():
    t,x=ext(title)
    i=x.lower().find(needle.lower())
    print(cid,t,'FOUND' if i>=0 else 'no', x[max(0,i-80):i+120].replace('\n',' ') if i>=0 else '')
