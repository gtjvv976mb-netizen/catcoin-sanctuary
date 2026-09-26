import json,sys
SH=sys.argv[1]; P=json.load(open(sys.argv[2]))
s=json.load(open(f'{SH}/launch-sheet.json')); md=open(f'{SH}/launch-sheet.md').read()
for c in s:
  p=P.get(c['ticker'])
  if not p: continue
  od=c['description']
  if 'story' in p:
    c['story']=p['story']; c['description']=f"{p['story']} {c['tribute']} {c['disclosure']}"
    md=md.replace(od,c['description'])
  if 'look' in p:
    md=md.replace(c['look'],p['look']); c['look']=p['look']
json.dump(s,open(f'{SH}/launch-sheet.json','w'),indent=1,ensure_ascii=False); open(f'{SH}/launch-sheet.md','w').write(md)
