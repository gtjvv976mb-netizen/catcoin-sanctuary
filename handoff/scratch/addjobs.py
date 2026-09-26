import json,sys
j=json.load(open('jobs.json'))
for a in sys.argv[1:]:
    k,v=a.split('='); j[k]=v
json.dump(j,open('jobs.json','w'),indent=0); print(len(j))
