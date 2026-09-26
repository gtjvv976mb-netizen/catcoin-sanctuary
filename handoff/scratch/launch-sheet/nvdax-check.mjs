const cr = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const disc = "A cat coin priced in NVDAx. Not affiliated with NVIDIA Corporation or StonkFun. No intrinsic value; not financial advice.";
const C = [
 {name:"Dewdrop the Sunrise Cat",ticker:"DEWDROP",description:"Dewdrop is a lean grey tabby with a white chin, white bib and four white socks. Each sunrise she tiptoes over the wet lawn, leaving paw prints in the dew. A cat coin priced in NVDAx. Not affiliated with NVIDIA Corporation or StonkFun. No intrinsic value; not financial advice.",
  look:"A lean short-haired dark-grey tabby house cat with a white chin and muzzle, a white bib and four white paws, and a long grey striped tail held high, stepping over dewy grass. It wears nothing."},
 {name:"Sockfoot the Garden Tabby",ticker:"SOCKFOOT",description:"Sockfoot is a grey tabby in four white socks and a white bib. At first light he strolls the garden path, sniffs each flower bed, then naps on warm stones. A cat coin priced in NVDAx. Not affiliated with NVIDIA Corporation or StonkFun. No intrinsic value; not financial advice.",
  look:"A slim dark-grey tabby shorthair house cat whose four white paws look like socks, with a white bib and white muzzle and a long striped grey tail, strolling a garden path. It wears nothing. The 'socks' are only its white fur."},
 {name:"Splashdash the Lawn Cat",ticker:"SPLASHDASH",description:"Splashdash is a sleek grey tabby with a white muzzle and snowy paws. When the sprinklers pop up she darts off, shakes dry and trots back to purr. A cat coin priced in NVDAx. Not affiliated with NVIDIA Corporation or StonkFun. No intrinsic value; not financial advice.",
  look:"A sleek dark-grey tabby shorthair house cat with a white muzzle, white chest and snowy-white paws, mid-trot across green grass with a few water droplets flicking off its coat. It wears nothing."},
];
const stockTerms = ["NVDA","NVDAx","NVIDIA","Nvidia Corporation","Jensen","Huang","Jensen Huang","GeForce","RTX","GTX","Jetson","CUDA","Caffe","GANimal","GANimals","Cat Chaser","StyleGAN","LSUN","Dawn","Dusk","Nalu","Medusa","Grace","Hopper","Blackwell","Rubin","Ampere","Shield","Spark","Drive","DGX","Omniverse","Tegra","Tesla","Jaguar","Land Rover","JLR","Caterpillar","NIVI","Robert Bond","Endeavor","Voyager","Xstock","xStocks","Backed","nvidiamascot"];
const out = [];
for (const c of C) {
  const story = c.description.slice(0, c.description.indexOf(disc)).trim();
  const r = {
    name: c.name, ticker: c.ticker,
    nameLen: c.name.length, tickerLen: c.ticker.length, descLen: c.description.length, lookLen: c.look.length,
    endsWithDisclosure: c.description.endsWith(disc),
    tickerFormat: cr.TICKER.test(c.ticker),
    checkProposal: cr.checkProposal({ name: c.name, symbol: c.ticker, tagline: story }),
    checkProposalFullDesc: cr.checkProposal({ name: c.name, symbol: c.ticker, tagline: c.description }),
    displaySafe: cr.displaySafe({ name: c.name, symbol: c.ticker }),
    checkFieldsFull: cr.checkFields({ name: c.name, symbol: c.ticker, description: c.description }),
    checkFieldsStoryLook: cr.checkFields({ story, look: c.look }),
    checkTerms: cr.checkTerms({ name: c.name, symbol: c.ticker, story, look: c.look }, { stock: stockTerms }),
  };
  out.push(r);
}
console.log(JSON.stringify(out, null, 1));
