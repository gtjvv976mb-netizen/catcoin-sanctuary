from PIL import Image, ImageDraw, ImageFont
import math
S=1024
base=Image.open('logo/s1.png').convert('RGB').resize((S,S), Image.LANCZOS)
# darken the grass band so the name reads
shade=Image.new('L',(S,S),0); d=ImageDraw.Draw(shade)
for y in range(620,S):
    d.line([(0,y),(S,y)], fill=int(min(150,(y-620)*0.9)))
base=Image.composite(Image.new('RGB',(S,S),(46,28,40)), base, shade)
font=ImageFont.truetype('kit/Gluten.ttf',96)
try: font.set_variation_by_name('Bold')
except Exception: pass
dr=ImageDraw.Draw(base)
worst=0
for text,y,col in [('Catcoin',668,(255,244,228)),('Sanctuary',768,(255,178,92))]:
    l,t,r,b=dr.textbbox((0,0),text,font=font,stroke_width=6)
    w=r-l; x=(S-w)//2-l
    dr.text((x,y),text,font=font,fill=col,stroke_width=6,stroke_fill=(46,28,40))
    # how close each text corner comes to the circle edge
    for cx in (x+l,x+r):
        for cy in (y+t,y+b):
            worst=max(worst,math.hypot(cx-S/2,cy-S/2))
print('furthest text corner from centre:',round(worst),'of radius',S//2)
base.save('logo/catcoin-sanctuary-avatar.png')
base.resize((400,400),Image.LANCZOS).save('logo/catcoin-sanctuary-avatar-400.png')
m=Image.new('L',(S,S),0); ImageDraw.Draw(m).ellipse((0,0,S-1,S-1),fill=255)
bg=Image.new('RGB',(S,S),(20,20,20)); bg.paste(base,(0,0),m); bg.resize((400,400)).save('logo/circle-check2.jpg')
