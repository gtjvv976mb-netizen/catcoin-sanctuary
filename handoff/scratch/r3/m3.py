import json,sys
f='jobs.json'; j=json.load(open(f)); s=int(sys.argv[1])
for k,x in enumerate(sys.argv[2:]): j[str(16000+s+k)]=x
json.dump(j,open(f,'w'),indent=0); print(s+len(sys.argv)-2)
