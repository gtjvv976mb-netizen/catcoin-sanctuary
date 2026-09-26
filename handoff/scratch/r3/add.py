import json,sys,re,os
f='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3/jobs.json'
j=json.load(open(f)) if os.path.exists(f) else {}
s=sys.stdin.read()
for i,jid in re.findall(r'"index":(\d+),"job_id":"([0-9a-f-]{36})"',s): j[i]=jid
for jid,u in re.findall(r'"job_id":"([0-9a-f-]{36})","status":"completed","type":"\w+","model":"[\w-]+","result_url":"([^"]+)"',s): j['url:'+jid]=u
json.dump(j,open(f,'w'),indent=0);print(len(j))
