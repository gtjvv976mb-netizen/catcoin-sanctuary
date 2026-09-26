#!/usr/bin/env python3
import sys,subprocess,urllib.parse,re,html,base64
q=" ".join(sys.argv[1:])
h=subprocess.run(["curl","-sS","-m","25","-A","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36","-H","Accept-Language: en-US,en;q=0.9","https://www.bing.com/search?setlang=en&cc=US&q="+urllib.parse.quote_plus(q)],capture_output=True).stdout.decode('utf-8','replace')
print("## bing-html:",q,len(h))
for m in re.finditer(r'<li class="b_algo"(.*?)</li>\s*(?=<li class="b_|</ol>)',h,re.S):
    b=m.group(1)
    a=re.search(r'<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>',b,re.S)
    if not a: continue
    u=html.unescape(a.group(1))
    if 'bing.com/ck/a' in u:
        mm=re.search(r'[?&]u=a1([^&]+)',u)
        if mm:
            s=mm.group(1); s+='='*(-len(s)%4)
            try: u=base64.urlsafe_b64decode(s).decode()
            except Exception: pass
    t=html.unescape(re.sub('<.*?>','',a.group(2)))
    p=re.search(r'<p[^>]*>(.*?)</p>',b,re.S)
    s=html.unescape(re.sub('<.*?>','',p.group(1))) if p else ''
    print('-',t,'|',u); print('   ',s[:350])
