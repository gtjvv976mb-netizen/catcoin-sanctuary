const r = await fetch(process.argv[2]); const b = Buffer.from(await r.arrayBuffer());
(await import("fs")).writeFileSync("SCHH-src.jpg", b); console.log(r.status, r.headers.get("content-type"), b.length);
