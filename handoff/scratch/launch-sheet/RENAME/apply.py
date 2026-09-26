import json,os,re,shutil,sys
SH=sys.argv[1]; REDO=json.load(open(sys.argv[2])); NOW='2026-09-26'
EX='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/redraw/exact'
jobs={l.split('\t')[1]:l.split('\t') for l in open(EX+'/jobs.tsv').read().strip().split('\n')}
IM=f'{SH}/images'; os.makedirs(IM+'/softened-originals',exist_ok=True)
sheet=json.load(open(f'{SH}/launch-sheet.json')); md=open(f'{SH}/launch-sheet.md').read()
man=json.load(open(IM+'/manifest.json')) if os.path.exists(IM+'/manifest.json') else None
for c in sheet:
  r=REDO.get(c['ticker'])
  if not r: continue
  old=c['ticker']; new=r.get('new',old); oldname=c['name']
  trib=f"Fan tribute to {r['company']}'s cat. Not affiliated with or endorsed by {r['company']}."
  if r.get('name'): c['name']=r['name']
  c['ticker']=new; c['story']=r['story']; c['tribute']=trib
  c['description']=f"{r['story']} {trib} {c['disclosure']}"
  if r.get('look'): c['look']=r['look']; c.pop('coat',None)
  c['whyLook']=r['why']
  oldpng=c['image']; old512=c['imageJpg512']
  newpng=f'{IM}/{new}.png'; new512=f'{IM}/{new}-512.jpg'
  if r['redraw']:
    for p in (oldpng,old512):
      if os.path.exists(p): shutil.move(p, IM+'/softened-originals/'+os.path.basename(p))
    shutil.copy(f'{EX}/{new}.png',newpng); shutil.copy(f'{EX}/{new}-512.jpg',new512)
    j=jobs[new]; c['imageJobId']=j[3]; c['imageUrl']=f"https://d8j0ntlcm91z4.cloudfront.net/user_3JZSMzfLba5srJNn6vNI9xpZHJd/{j[4]}_{j[3]}.png"
    c['imageBytes']=os.path.getsize(newpng); c['imageSize']='1024x1024'
    c['imageNote']=f"Redrawn {NOW} to match the company's cat exactly (owner's ruling); the softened picture is in images/softened-originals/{os.path.basename(oldpng)}."
  elif new!=old:
    for p,q in ((oldpng,newpng),(old512,new512)):
      if os.path.exists(p): os.rename(p,q)
  c['image']=newpng; c['imageJpg512']=new512
  if 'form' in c and isinstance(c['form'],dict):
    c['form']['tokenName']=c['name']; c['form']['symbol']=new; c['form']['tokenImage']=newpng
  if new!=old or r.get('name'):
    c['renamedFrom']={'name':oldname,'ticker':old,'on':NOW,'nameSource':r.get('src')}
  c['basis']=c.get('basis','')+f" Owner's ruling {NOW}: " + ("renamed to the real cat's exact name '"+c['name']+"' (source: "+str(r.get('src'))+"); " if r.get('src') else "") + ("picture redrawn to match the company's cat exactly; " if r['redraw'] else "") + "fan-tribute line added."
  if man is not None:
    for e in man:
      if e.get('ticker')==old:
        e['ticker']=new; e['png']=newpng; e['jpg512']=new512
        if r['redraw']: e.update({'job_id':c['imageJobId'],'result_url':c['imageUrl'],'png_bytes':c['imageBytes'],'jpg_bytes':os.path.getsize(new512),'note':c['imageNote']})
        if new!=old: e['renamedFrom']=old
  # md
  m=re.search(r'^### (\d+)\. (\S+) → '+re.escape(old)+r'\b.*$',md,re.M)
  if m:
    a=m.start(); b=md.find('\n### ',a+5); b=len(md) if b<0 else b
    nxt=md.find('\n## ',a+5)
    if 0<nxt<b: b=nxt
    sec=md[a:b]
    sec=re.sub(r'(^### \d+\. \S+ → )'+re.escape(old)+r'\b',lambda x:x.group(1)+new,sec,flags=re.M)
    sec=sec.replace(f'`{oldname}`',f"`{c['name']}`").replace(f'`{old}`',f'`{new}`')
    sec=re.sub(r'images/'+re.escape(old)+r'(\.png|-512\.jpg)',lambda x:'images/'+new+x.group(1),sec)
    sec=re.sub(r"  > .*",lambda _:"  > "+c['description'],sec,count=1)
    if re.search(r"\*\*Why it looks like this:\*\*",sec): sec=re.sub(r"(- \*\*Why it looks like this:\*\*) .*",lambda x:x.group(1)+" "+r['why'],sec)
    else: sec=sec.rstrip('\n')+"\n- **Why it looks like this:** "+r['why']+"\n"
    if '**Tribute line' in sec: sec=re.sub(r"(- \*\*Tribute line[^:]*:\*\*) .*",lambda x:x.group(1)+" "+trib,sec)
    else: sec=sec.replace("- **Why it looks like this:**",f"- **Tribute line (on the card and in the description):** {trib}\n- **Why it looks like this:**",1)
    add=""
    if r.get('look'): add+=f"- **Look (redrawn {NOW}):** {r['look']}\n"
    if r['redraw']: add+=f"- **Art:** redrawn {NOW} to match the company's cat exactly (Higgsfield job {c['imageJobId']}); the softened picture is kept in `images/softened-originals/`.\n"
    if r.get('src'): add+=f"- **Name:** renamed {NOW} from `{oldname}` / `{old}` to the real cat's exact name. Source: {r['src']}.\n"
    sec=sec.rstrip('\n')+"\n"+add
    md=md[:a]+sec+("\n" if not sec.endswith("\n\n") else "")+md[b:].lstrip('\n') if False else md[:a]+sec+md[b:]
  else: print('no md section for',old)
json.dump(sheet,open(f'{SH}/launch-sheet.json','w'),indent=1,ensure_ascii=False)
open(f'{SH}/launch-sheet.md','w').write(md)
if man is not None: json.dump(man,open(IM+'/manifest.json','w'),indent=1)
print('done')
