const q = encodeURIComponent('"Olivia Benson" cat "Scottish Fold"');
const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=10`, { headers: { "user-agent": "cat-sanctuary-research/1.0" } });
const j = await r.json();
for (const s of j.query?.search ?? []) console.log(s.title, "|", s.snippet.replace(/<[^>]+>/g, ""));
