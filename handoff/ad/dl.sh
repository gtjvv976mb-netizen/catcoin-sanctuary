# usage: dl.sh name url
curl -sSf -o "keyframes/$1.png" "$2" && python3 -c "
from PIL import Image; import sys
im=Image.open('keyframes/$1.png'); print('$1', im.size)
w=1400 if im.size[0]>=im.size[1] else 700
im.convert('RGB').resize((w,int(w*im.size[1]/im.size[0]))).save('qa/$1.jpg',quality=85)"
