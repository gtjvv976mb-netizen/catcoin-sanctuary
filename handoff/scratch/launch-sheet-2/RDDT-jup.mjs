for (const q of ["JUP","SOCKLET","NATTER","CHITCHAT","SNOWTOES","HUBBUB"]) {
  const r=await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${q}`); const a=await r.json();
  console.log(q, r.status, a.length, JSON.stringify(a.filter(t=>String(t.symbol).toUpperCase()===q).map(t=>({s:t.symbol,n:t.name,v:t.isVerified,id:t.id}))).slice(0,600));
}
