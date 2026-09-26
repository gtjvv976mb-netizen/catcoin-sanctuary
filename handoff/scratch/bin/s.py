#!/usr/bin/env python3
import sys, urllib.parse, subprocess, re, html, xml.etree.ElementTree as ET
def fetch(url):
    r = subprocess.run(["curl","-sS","-m","25","-L","-A","Mozilla/5.0",url],capture_output=True)
    return r.stdout.decode("utf-8","replace")
def ddg(q):
    h = fetch("https://html.duckduckgo.com/html/?q="+urllib.parse.quote_plus(q))
    out=[]
    for m in re.finditer(r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</a>', h, re.S):
        u=m.group(1)
        if "uddg=" in u:
            u=urllib.parse.unquote(u.split("uddg=")[1].split("&")[0])
        t=re.sub("<.*?>","",m.group(2)); s=re.sub("<.*?>","",m.group(3))
        out.append((html.unescape(t),u,html.unescape(s)))
    return out
def bing(q):
    x = fetch("https://www.bing.com/search?format=rss&q="+urllib.parse.quote_plus(q))
    out=[]
    try:
        root=ET.fromstring(x)
        for it in root.iter("item"):
            out.append((it.findtext("title"),it.findtext("link"),(it.findtext("description") or "")+" ["+(it.findtext("pubDate") or "")+"]"))
    except Exception as e:
        out.append(("ERR",str(e),x[:200]))
    return out
def gnews(q):
    x = fetch("https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q="+urllib.parse.quote_plus(q))
    out=[]
    try:
        root=ET.fromstring(x)
        for it in root.iter("item"):
            out.append((it.findtext("title"),it.findtext("link")[:80],it.findtext("pubDate")))
    except Exception as e:
        out.append(("ERR",str(e),x[:200]))
    return out
eng=sys.argv[1]; q=" ".join(sys.argv[2:])
res={"d":ddg,"b":bing,"g":gnews}[eng](q)
print(f"## {eng}: {q}  ({len(res)} results)")
for t,u,s in res[:15]:
    print("-",t,"|",u); print("   ",(s or "")[:300])
