import json,sys
st=json.load(open('state.json'))
for a in sys.argv[1:]:
  t,u=a.split('=',1); st[t]['url']=u; st[t]['status']='done'
json.dump(st,open('state.json','w'),indent=1)
J='/home/user/cat-sanctuary/scripts/cat-models.jobs.json'
j=json.load(open(J))
for t,v in st.items():
  if v.get('status')=='done': j.setdefault(t,{}).update(v)
open(J,'w').write(json.dumps(j,indent=1)+'\n')
