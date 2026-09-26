import json,os
S='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet'
O="An original cat: no company cat, mascot or logo was used for it. "
N={
'HARRUMPH':dict(job='f4ff37d1-574e-454c-8c46-17c82dc14f11',url='hf_20260925_224329_f4ff37d1-574e-454c-8c46-17c82dc14f11',
 story="Harrumph, a stern chocolate-brown cat with copper eyes, frowns at pigeons from the garden wall all morning, then climbs into a lap to purr.",
 look="A normal four-legged short-haired house cat with a solid warm chocolate-brown coat, a normal rounded face with a short muzzle, bright copper eyes and a stern, frowning brow. It sits upright on an old stone garden wall, tail wrapped round its paws. It wears nothing: no collar, no logo.",
 why=O+"His plain chocolate-brown coat and copper eyes are a nod to old copper coins, and only his frown fits his name. He is short-haired with an ordinary face, nothing like the fluffy grey campaign cat Coinbase once posted.",
 coat=dict(base="chocolate",second="",pattern="solid",eyes="copper")),
'PEWTER':dict(job='5d74c717-999f-40cf-84a7-510dda0d3e76',url='hf_20260925_224328_5d74c717-999f-40cf-84a7-510dda0d3e76',
 story="Pewter, a plain silver-blue cat with round copper eyes, rolls on her back in the catmint patch each afternoon until she is happily dizzy.",
 look="A normal four-legged short-haired house cat with a plain solid silver-blue coat, with no stripes and no white markings, large round copper eyes and a grey nose. She lies on her back, belly up, rolling happily in a patch of purple flowering catmint, paws in the air. She wears nothing: no hat and no clothing.",
 why=O+"She is named for pewter, the soft grey metal, so her coat is one plain silver-blue with no stripes or markings, and her eyes are copper. No tabby bars, no cap and no pixel art.",
 coat=dict(base="silver",second="",pattern="solid",eyes="copper")),
'SNOWCURL':dict(job='45646f66-2e48-43c5-a8e8-86a9c752fd25',url='hf_20260925_224328_45646f66-2e48-43c5-a8e8-86a9c752fd25',
 story="Snowcurl, a fluffy white cat with one blue eye and one gold, curls into a snowball under the ferns on hot days and naps there to recharge.",
 look="A fluffy long-haired pure white four-legged house cat with a thick ruff and odd eyes, one blue and one gold. She is curled up in a round ball nose-to-tail on cool moss in the shade of a large fern, eyes half open. She wears nothing: no collar, badge or logo.",
 why=O+"The 'curl' is how she sleeps, curled nose to tail like a coil left to recharge in the shade. Her long fluffy coat and odd eyes, one blue and one gold, are her own.",
 coat=dict(base="white",second="",pattern="solid",eyes="odd")),
'MOATCAT':dict(job='26e7cc8d-91dd-4190-8751-7a5afc52bcfc',url='hf_20260925_224328_26e7cc8d-91dd-4190-8751-7a5afc52bcfc',
 story="A big, calm brown tabby who lies by the garden pond as if it were his moat. He has kept that spot for years and lets nothing cross but butterflies.",
 look="A big, sturdy, mature four-legged house cat with a brown classic tabby coat (bold dark-brown swirls on warm brown), a cream chin, green eyes and a calm, patient expression. He lies in a loaf pose on a flat stone at the edge of a garden pond with lily pads. He wears nothing: no collar, no tag.",
 why=O+"The company is known for holding for the long term, so he is a big, mature, patient brown tabby who has kept the same spot by the pond for years. 'Moat' is an ordinary investing word.",
 coat=dict(base="brown",second="cream",pattern="tabby",eyes="green")),
'COUCHCAP':dict(job='6142a687-2789-4ac1-96c9-890ac194efc6',url='hf_20260925_224328_6142a687-2789-4ac1-96c9-890ac194efc6',
 story="A sleek black cat who stretches along the back of the garden sofa every evening, keeping watch over the seat where everyone gathers, then naps at sundown.",
 look="A sleek, short-haired, solid black four-legged house cat with bright yellow-green eyes, stretched out along the back cushion of a moss-green garden sofa, one front paw dangling over the edge, calmly keeping watch. Nothing in its paws. No logos, watermark or text.",
 why=O+"The company builds places where people gather, so this sleek black cat keeps watch from the back of the garden sofa where everyone sits. There is no remote, no TV and no demo cat.",
 coat=dict(base="black",second="",pattern="solid",eyes="green")),
'WARMSPOT':dict(job='c0134e50-71ab-45da-9313-3d5115272ec2',url='hf_20260925_224329_c0134e50-71ab-45da-9313-3d5115272ec2',
 story="Warmspot, a fluffy cream cat with golden eyes, always finds the one stone the sun has cleared of snow, curls up on it, and keeps it.",
 look="A fluffy, medium-long-haired solid cream four-legged house cat with pale golden eyes and a pink nose, curled snugly on a large flat sun-warmed garden stone that has melted clear of snow, with snow all around. She wears nothing.",
 why=O+"She is a fluffy cream cat on a sun-warmed stone, a nod to sunlight and open sky. There is no dish, no sticker and no tuxedo coat.",
 coat=dict(base="cream",second="",pattern="solid",eyes="golden")),
'SOCKFOOT':dict(job='bbd53f74-1cfc-4372-b1d6-ca7805f1fcaf',url='hf_20260925_224329_bbd53f74-1cfc-4372-b1d6-ca7805f1fcaf',
 story="Sockfoot is a cream colourpoint with dark brown legs like socks and sapphire eyes. At first light he walks the stepping stones, tail high, the first cat up.",
 look="A slim colourpoint house cat: a pale cream body with a dark seal-brown face mask, ears and tail, four dark seal-brown legs that look like dark socks, and bright sapphire-blue eyes. A normal four-legged cat walking along a stepping-stone garden path, tail held up. It wears nothing; the 'socks' are only its fur.",
 why=O+"His 'socks' are dark, not white: a colourpoint coat is darkest where the body runs coolest, a small nod to keeping hot chips cool. Pale cream body, seal-brown points, blue eyes.",
 coat=dict(base="cream",second="seal",pattern="point",eyes="blue")),
'HALFSMILE':dict(job='00844668-841f-434e-9ca0-39f1e89d19d9',url='hf_20260925_224329_00844668-841f-434e-9ca0-39f1e89d19d9',
 story="A blue-cream cat with hazel eyes and a lopsided half smile, who stretches out on the shed's sunny windowsill and smiles at everyone who passes.",
 look="A normal four-legged short-haired blue-cream tortoiseshell house cat, her coat softly mottled in blue-grey and pale cream with no white, warm hazel eyes and a gentle lopsided half smile. She lies stretched out on a sunny wooden windowsill outside a garden shed, chin on her paws. No collar and no accessories.",
 why=O+"She is a soft blue-cream tortoiseshell with hazel eyes and no white, napping on a sunny windowsill; her half smile is her own. No game skin and no real cat's photo was used.",
 coat=dict(base="blue",second="cream",pattern="tortie",eyes="hazel")),
}
B='https://d8j0ntlcm91z4.cloudfront.net/user_3JZSMzfLba5srJNn6vNI9xpZHJd/'
d=json.load(open(S+'/launch-sheet.json'))
for e in d:
  n=N.get(e['ticker'])
  if not n: continue
  e['story']=n['story']; e['description']=n['story']+' '+e['disclosure']
  e['look']=n['look']; e['whyLook']=n['why']; e['coat']=n['coat']
  e['basis']="Redrawn 2026-09-25 as an original cat on the owner's ruling ('Redraw as original cats'). The earlier picture was held because it followed a company's cat; that picture is kept in images/held-originals/ and is not used. The new picture was drawn from the look above only, with an earlier sanctuary cat (PATCHPAW, job 6dc202df) as a style reference."
  e['imageJobId']=n['job']; e['imageUrl']=B+n['url']+'.png'; e['imageBytes']=os.path.getsize(e['image']); e['imageSize']='1024x1024'
  e['artLicence']="CC BY 4.0 (credit: Catcoin Sanctuary)"
  assert len(e['description'])<=280 and len(n['story'])<=160, (e['ticker'],len(e['description']),len(n['story']))
json.dump(d,open(S+'/launch-sheet.json','w'),indent=2,ensure_ascii=False)
json.dump({k:{kk:v[kk] for kk in ('job','story','look','why','coat')} for k,v in N.items()},open(S+'/../redraw/new.json','w'),indent=1)
m=json.load(open(S+'/images/manifest.json'))
for x in m:
  n=N.get(x['ticker'])
  if n: x['job_id']=n['job']; x['result_url']=B+n['url']+'.png'; x['png_bytes']=os.path.getsize(x['png']); x['jpg_bytes']=os.path.getsize(x['jpg512'])
json.dump(m,open(S+'/images/manifest.json','w'),indent=1)
print('ok')
