import json,re,subprocess,time,os
out={}
if os.path.exists('fx.json'): out=json.load(open('fx.json'))
for line in open('xurls.txt'):
    line=line.strip()
    if not line: continue
    cid,url=line.split('|',1)
    if url in out and out[url].get('ok'): continue
    m=re.search(r'(?:x|twitter)\.com/([^/]+)/status/(\d+)',url)
    if not m: out[url]={'id':cid,'ok':False,'err':'nourl'}; continue
    h,i=m.groups()
    r=subprocess.run(['curl','-sS','-m','25',f'https://api.fxtwitter.com/{h}/status/{i}'],capture_output=True,text=True)
    try: d=json.loads(r.stdout)
    except: d={}
    t=d.get('tweet')
    if d.get('code')==200 and t:
        media=[x.get('url') for x in ((t.get('media') or {}).get('all') or [])]
        out[url]={'id':cid,'ok':True,'url':f"https://x.com/{t['author']['screen_name']}/status/{t['id']}",'handle':t['author']['screen_name'],'name':t['author'].get('name'),'followers':t['author'].get('followers'),'date':t['created_at'],'text':t['text'],'media':media}
    else:
        out[url]={'id':cid,'ok':False,'err':str(d.get('code'))+' '+str(d.get('message'))}
    print(cid,out[url]['ok'],out[url].get('handle'),out[url].get('date','')[:16],(out[url].get('text') or out[url].get('err',''))[:80].replace('\n',' '),flush=True)
    json.dump(out,open('fx.json','w'),indent=1)
    time.sleep(0.3)
