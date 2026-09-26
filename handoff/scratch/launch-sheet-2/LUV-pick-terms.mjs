const R = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const stockTerms = { stock: ["LUV","Luv","Love","Lovely","Love Field","Southwest","Southwest Airlines","Southwest Airlines Co","SWA","Heart","Rapid Rewards","Wanna Get Away","Bags Fly Free","Canyon Blue","Herb Kelleher","Kelleher","Rollin King","Bob Jordan","Walter","Avery","Zuko","Matthew Prebish","Prebish","Way","Somali","Flying with Felines","Winged Cat","WingedCat","Flying Tigers","Meow Wolf","Backpack","Backpack Securities","Sunrise","Wormhole","Dallas","Airline","Airlines","Jet","Flight","Fly"] };
const pick = { name:"Emberwisp the Ruddy Cat", symbol:"EMBERWISP", tagline:"Emberwisp, a ruddy-orange kitten with a softly ticked fluffy coat, tall ears and a cream chin, watches the garden sparrows." };
const DISC = "A cat coin priced in LUV. Not affiliated with Southwest Airlines, Backpack Securities or StonkFun. No intrinsic value; not financial advice.";
console.log(JSON.stringify({
  terms_nameTickerBlurb: R.checkTerms(pick, stockTerms),
  terms_disclaimerOnly: R.checkTerms({ disclaimer: DISC }, stockTerms),
  proposal_nameTickerBlurb: R.checkProposal(pick),
}, null, 1));
