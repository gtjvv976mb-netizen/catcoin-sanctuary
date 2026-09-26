from PIL import Image, ImageDraw
L='logo/'
srcs={'OLD':L+'catcoin-sanctuary-avatar.png','A':L+'big/A/avatar.png','B':L+'big/B/avatar.png','C':L+'big/C/avatar.png'}
def circ(im,s):
    im=im.convert('RGB').resize((s,s),Image.LANCZOS)
    m=Image.new('L',(s*4,s*4),0); ImageDraw.Draw(m).ellipse((0,0,s*4-1,s*4-1),fill=255); m=m.resize((s,s),Image.LANCZOS)
    return im,m
# row per bg: dark (X dark mode #000) and white
W=4*(400+20)+20
out=Image.new('RGB',(W,2*(400+96+48+60)+20),(0,0,0))
for bi,bg in enumerate([(0,0,0),(255,255,255)]):
    y0=bi*(400+96+48+60)
    ImageDraw.Draw(out).rectangle((0,y0,W,y0+400+96+48+60),fill=bg)
    for i,(k,p) in enumerate(srcs.items()):
        im=Image.open(p)
        x=20+i*420
        for s,yy in [(400,y0+10),(96,y0+420),(48,y0+530)]:
            c,m=circ(im,s); out.paste(c,(x,yy),m)
        # also 32
        c,m=circ(im,32); out.paste(c,(x+120,y0+530),m)
out.save('judge-brand/avatars.png')
# upscale small ones 4x for inspection
big=Image.new('RGB',(4*(96*3+20),96*3*2+30),(0,0,0))
for i,(k,p) in enumerate(srcs.items()):
    im=Image.open(p)
    c,m=circ(im,96); c2=Image.new('RGB',(96,96),(0,0,0)); c2.paste(c,(0,0),m)
    big.paste(c2.resize((288,288),Image.NEAREST),(i*308,0))
    c,m=circ(im,48); c2=Image.new('RGB',(48,48),(255,255,255)); c2.paste(c,(0,0),m)
    big.paste(c2.resize((288,288),Image.NEAREST),(i*308,300))
big.save('judge-brand/small-zoom.png')
