import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import make
from PIL import Image, ImageDraw
outs=[]
for name, over in [('inset0', dict(top_inset=0)), ('inset20', dict(top_inset=20)), ('inset36', dict(top_inset=36)),
                   ('px150_inset20', dict(px=150, top_inset=20))]:
    cfg=dict(make.BADGE); cfg.update(over); rep={}
    img=make.build_badge(cfg=cfg, report=rep)
    print(name, round(rep['text_far'],2), rep['sanctuary_span_px'], round(rep['disc_r'],1))
    outs.append(make.circle_crop(img.resize((480,480), Image.LANCZOS), bg=(236,232,228)))
    outs.append(make.circle_crop(img.resize((96,96), Image.LANCZOS), bg=(236,232,228)).resize((192,192), Image.NEAREST))
sheet=Image.new('RGB',(4*490, 700),(236,232,228))
for i in range(4):
    sheet.paste(outs[2*i],(i*490,0)); sheet.paste(outs[2*i+1],(i*490+140,495))
sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)),'variants.jpg'),quality=90)
