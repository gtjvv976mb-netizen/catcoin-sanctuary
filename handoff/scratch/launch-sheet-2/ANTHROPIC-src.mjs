const urls = ["https://raw.githubusercontent.com/anthropics/claude-desktop-buddy/main/src/buddies/cat.cpp",
"https://raw.githubusercontent.com/anthropics/claude-desktop-buddy/master/src/buddies/cat.cpp"];
for (const u of urls) { try { const r = await fetch(u); console.log("URL", u, r.status); if (r.ok) { console.log(await r.text()); break; } } catch(e) { console.log("ERR", u, String(e)); } }
