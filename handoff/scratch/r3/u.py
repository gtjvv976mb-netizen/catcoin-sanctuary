import json,sys
j=json.load(open('jobs.json'));B='https://d8j0ntlcm91z4.cloudfront.net/user_3FyGGgvr86P2yKo8RswRabCMo0c/hf_20260926_'
for a in sys.argv[1:]:
  t,id=a.split(':');j['url:'+id]=B+t+'_'+id+'.glb'
json.dump(j,open('jobs.json','w'),indent=0)
