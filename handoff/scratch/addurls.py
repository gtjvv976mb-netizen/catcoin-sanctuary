import json,sys,os
f='urls.json'; u=json.load(open(f)) if os.path.exists(f) else {}
B='https://d8j0ntlcm91z4.cloudfront.net/user_3FyGGgvr86P2yKo8RswRabCMo0c/hf_'
for a in sys.argv[1:]:
    k,v=a.split('=',1); u[k]=v if v.startswith('http') else B+v
json.dump(u,open(f,'w'),indent=0); print(len(u))
