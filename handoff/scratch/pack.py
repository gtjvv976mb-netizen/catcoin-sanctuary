import json,subprocess,sys,re
J='/home/user/cat-sanctuary/scripts/cat-models.jobs.json'
GP='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/gp/node_modules/.bin/gltfpack'
for t in sys.argv[1:]:
    for attempt in range(5):
        r=subprocess.run(['python3','scripts/make-cat-models.py','--gltfpack',GP,t],cwd='/home/user/cat-sanctuary',capture_output=True,text=True)
        out=r.stdout+r.stderr
        hi='%s.glb is'%t in out and 'over' in out.split('%s.glb is'%t)[1][:60]
        lo='%s-lo.glb is'%t in out
        if r.returncode!=0 and not (hi or lo): print(t,'ERROR',out[-500:]); break
        if not hi and not lo: print(t,'ok',out.strip().splitlines()[-1]); break
        d=json.load(open(J)); e=d[t]
        if hi and attempt>=1: e['sa']=True; e['q']=70; e['si']=0.02
        elif hi: e['q']=max(50,e.get('q',78)-8); e['si']=round(e.get('si',0.04)*0.8,4)
        if lo:
            if not e.get('sa_lo'): e['sa_lo']=True; e['si_lo']=0.01
            else: e['si_lo']=round(e.get('si_lo',0.01)*0.6,4)
        json.dump(d,open(J,'w'),indent=1); open(J,'a').write('\n')
        print(t,'retry',attempt,e['q'],e['si'],e['si_lo'])
