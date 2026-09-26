import sys, io, base64, numpy as np
sys.path.insert(0,'.')
import make as M
from PIL import Image, ImageFilter
OUT='/home/user/cat-sanctuary/'
# full wordmark, cleaned alpha, tight crop
cat, san = M.wordmark_lines()
wm = Image.open(M.WM_SRC).convert('RGBA')
a = np.asarray(wm).astype(np.float32); al=np.clip((a[...,3]-16)/(239),0,1)
wm = Image.fromarray(np.dstack([a[...,:3], al*255]).astype(np.uint8),'RGBA')
bb = wm.getchannel('A').point(lambda v:255 if v>12 else 0).getbbox(); wm=wm.crop(bb)
print('wordmark', wm.size)
for w in (240,480,960):
    s=M.scaled_rgba(wm, w/wm.width); s.save(OUT+f'assets/brand/wordmark-{w}.webp', quality=86, method=6); print(w, s.size)
# favicon from avatar cat face
av = Image.open('avatar.png').convert('RGB')
face = av.crop((360,130,660,430))
face.resize((180,180),M.LANCZOS).save(OUT+'assets/icons/apple-touch-icon.png', optimize=True)
face.resize((512,512),M.LANCZOS).save(OUT+'assets/brand/avatar-face-512.webp', quality=85)
av.resize((256,256),M.LANCZOS).save(OUT+'assets/brand/avatar-256.webp', quality=85)
def rnd(im):
    k=4; m=Image.new('L',(im.width*k,im.height*k),0)
    from PIL import ImageDraw; ImageDraw.Draw(m).ellipse((0,0,m.width-1,m.height-1),fill=255)
    im=im.convert('RGBA'); im.putalpha(m.resize(im.size,M.LANCZOS)); return im
ic = rnd(face.resize((256,256),M.LANCZOS))
ic.save(OUT+'favicon.ico', sizes=[(16,16),(32,32),(48,48)])
b=io.BytesIO(); rnd(face.resize((64,64),M.LANCZOS)).save(b,'PNG',optimize=True)
open(OUT+'assets/icons/favicon.svg','w').write('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,%s"/></svg>\n' % base64.b64encode(b.getvalue()).decode())
# OG image
sc = Image.open(M.GEN+'/r6_banner_b.png').convert('RGB')
H=630; W=round(sc.width*H/sc.height); sc=sc.resize((W,H),M.LANCZOS).crop((W-1200-20,0,W-20,H)).convert('RGBA')
# darken left for legibility
g=np.linspace(0.45,0,1200)[None,:,None]; arr=np.asarray(sc).astype(np.float32); arr[...,:3]*=1-g*np.ones((H,1,1)); sc=Image.fromarray(arr.astype(np.uint8),'RGBA')
s=640/wm.width; w2=M.scaled_rgba(wm,s)
sc.alpha_composite(M.soft_shadow(M.text_layer(sc.size,w2,(40,60)),8,10,.55)); sc.alpha_composite(w2,(40,60))
tag=M.tagline_block('b'); ts=560/tag.width; tag=M.scaled_rgba(tag,ts) if ts<1 else tag
sc.alpha_composite(tag,(40+ (640-tag.width)//2, 60+w2.height+10))
sc.convert('RGB').save(OUT+'assets/og-image.jpg', quality=84, optimize=True, progressive=True)
print('tag',tag.size,'wm',w2.size)
