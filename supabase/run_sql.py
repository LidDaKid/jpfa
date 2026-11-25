import json, sys, urllib.request, os
REF = "ejxfdvzsgezwjkauszox"
tok = open(os.path.expanduser("~/.jpfa-supabase-token")).read().strip()
sql = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else sys.argv[1]
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query",
    data=json.dumps({"query": sql}).encode(), method="POST",
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "User-Agent": "jpfa-setup"})
try:
    print(urllib.request.urlopen(req).read().decode()[:3000])
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:3000]); sys.exit(1)
