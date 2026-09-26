import sys; from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w,h=ims[0].size; cols=min(3,len(ims)); rows=(len(ims)+cols-1)//cols
o=Image.new('RGB',(w*cols,h*rows),'white')
for i,im in enumerate(ims): o.paste(im,((i%cols)*w,(i//cols)*h))
o.save(sys.argv[1])
