# download view job results: tries timestamps by querying cloudfront listing is impossible; use result urls file
import json,sys,subprocess
idx=json.load(open('vidx.json'))
for line in open(sys.argv[1]):
  i,url=line.split()
  t,v=idx[i]; subprocess.run(['curl','-sS','-o',f'views/{t}-{v}.png',url])
