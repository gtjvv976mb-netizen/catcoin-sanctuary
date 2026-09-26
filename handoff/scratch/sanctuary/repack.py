"""Shrink every embedded texture of a GLB and repack it. usage: repack.py in.glb out.glb maxside quality"""
import json, struct, sys, io
from PIL import Image
src, dst, maxside, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
b = open(src, 'rb').read()
off = 12; js = None; binc = b''
while off < len(b):
    clen, ctype = struct.unpack('<II', b[off:off+8]); chunk = b[off+8:off+8+clen]
    if ctype == 0x4E4F534A: js = json.loads(chunk)
    elif ctype == 0x004E4942: binc = chunk
    off += 8 + clen
views = js['bufferViews']; img_views = {im['bufferView']: i for i, im in enumerate(js.get('images', [])) if 'bufferView' in im}
out = bytearray(); newviews = []
for vi, v in enumerate(views):
    data = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    if vi in img_views:
        im = Image.open(io.BytesIO(data)); before = im.size
        if max(im.size) > maxside: im = im.resize((maxside, maxside) if im.size[0] == im.size[1] else (round(im.size[0]*maxside/max(im.size)), round(im.size[1]*maxside/max(im.size))), Image.LANCZOS)
        buf = io.BytesIO(); im.convert('RGB').save(buf, 'JPEG', quality=q, optimize=True, progressive=False); data = buf.getvalue()
        js['images'][img_views[vi]]['mimeType'] = 'image/jpeg'
        print(f'  texture {before} -> {im.size}, {len(data)//1024} KB')
    while len(out) % 4: out.append(0)
    nv = dict(v); nv['byteOffset'] = len(out); nv['byteLength'] = len(data); newviews.append(nv); out += data
while len(out) % 4: out.append(0)
js['bufferViews'] = newviews; js['buffers'] = [{'byteLength': len(out)}]
jb = json.dumps(js, separators=(',', ':')).encode()
while len(jb) % 4: jb += b' '
total = 12 + 8 + len(jb) + 8 + len(out)
open(dst, 'wb').write(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<II', len(jb), 0x4E4F534A) + jb + struct.pack('<II', len(out), 0x004E4942) + bytes(out))
print(f'{src} -> {dst}: {len(b)//1024} KB -> {total//1024} KB')
