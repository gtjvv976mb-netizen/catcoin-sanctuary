import json,collections,statistics as st
BASE='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/'
R=BASE+'themes/raw/graduates/2026-09-25T12-28-33-000Z_'
L={}
for l in open(R+'launches_snapshot.jsonl'):
    x=json.loads(l); L[x['mint']]=x
P=[json.loads(l) for l in open(R+'peaks_snapshot.jsonl')]
P1=[p for p in P if p['ageH']==1]
TH={}
for l in open(BASE+'themes/graduates/launches_classified.jsonl'):
    x=json.loads(l); TH[x['mint']]=x
G=[json.loads(l) for l in open(BASE+'themes/graduates/graduates_classified.jsonl')]
SOL='11111111111111111111111111111111'
def qn(q):
    if q is None: return 'None'
    return {SOL:'SOL','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'USDC'}.get(q, 'other:'+q[:6])
