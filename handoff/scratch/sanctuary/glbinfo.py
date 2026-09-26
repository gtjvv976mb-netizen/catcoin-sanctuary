import json,struct,sys
for p in sys.argv[1:]:
    b=open(p,'rb').read()
    magic,ver,length=struct.unpack('<4sII',b[:12])
    off=12; js=None; binlen=0
    while off<len(b):
        clen,ctype=struct.unpack('<II',b[off:off+8]); chunk=b[off+8:off+8+clen]
        if ctype==0x4E4F534A: js=json.loads(chunk)
        else: binlen=clen
        off+=8+clen
    tris=0
    for m in js.get('meshes',[]):
        for pr in m['primitives']:
            if 'indices' in pr: tris+=js['accessors'][pr['indices']]['count']//3
            else: tris+=js['accessors'][pr['attributes']['POSITION']]['count']//3
    imgs=[(i.get('mimeType'), js['bufferViews'][i['bufferView']]['byteLength'] if 'bufferView' in i else None) for i in js.get('images',[])]
    mn=js['accessors'][js['meshes'][0]['primitives'][0]['attributes']['POSITION']].get('min'); mx=js['accessors'][js['meshes'][0]['primitives'][0]['attributes']['POSITION']].get('max')
    print(p, f"{len(b)/1024:.0f} KB", "meshes",len(js.get('meshes',[])),"tris",tris,"images",imgs,"materials",len(js.get('materials',[])),"bbox",mn,mx, "ext", js.get('extensionsUsed'))
