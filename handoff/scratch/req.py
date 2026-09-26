import json,sys,glob
b=[r for f in sorted(glob.glob('b*.json')) for r in json.load(open(f))]
ids=set(int(x) for x in sys.argv[1:])
print(json.dumps([r for r in b if r['index'] in ids]))
