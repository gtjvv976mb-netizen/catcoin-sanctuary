const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const look = "An ordinary four-legged house cat with a sleek, short, honey-golden coat, a soft metallic sheen and warm orange eyes. It likes to sit in a neat 'cat loaf' pose with its paws tucked under, so its body looks like a small rounded gold bar. It wears nothing; no logos or text.";
console.log(JSON.stringify({ lookLen: look.length, lookFields: R.checkFields({ look }), lookTerms: R.checkTerms({ look }, { stock: ["GLD","GLDX","GOLD xStock","SPDR","State Street","World Gold","spider"] }) }));
