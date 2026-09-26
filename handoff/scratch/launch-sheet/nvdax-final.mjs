const cr = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const disc = "A cat coin priced in NVDAx. Not affiliated with NVIDIA Corporation or StonkFun. No intrinsic value; not financial advice.";
const story = "Sockfoot is a grey tabby with a white bib and four white paws like socks. At first light he strolls the path, sniffs the flowers, then naps on warm stones.";
const c = { name: "Sockfoot the Garden Tabby", ticker: "SOCKFOOT", description: story + " " + disc,
  look: "A slim dark-grey tabby shorthair house cat with a white chin and muzzle, a white bib and four white paws that look like socks, and a long striped grey tail held up, strolling a garden path. It wears nothing; the 'socks' are only its white fur." };
const stockTerms = ["NVDA","NVDAx","NVIDIA","Nvidia Corporation","Jensen","Huang","Jensen Huang","GeForce","RTX","GTX","Jetson","CUDA","Caffe","GANimal","GANimals","Cat Chaser","StyleGAN","LSUN","Dawn","Dusk","Nalu","Medusa","Grace","Hopper","Blackwell","Rubin","Ampere","Shield","Spark","Drive","DGX","Omniverse","Tegra","Tesla","Jaguar","Land Rover","JLR","Caterpillar","NIVI","Robert Bond","Endeavor","Voyager","Xstock","xStocks","Backed","nvidiamascot"];
const r = {
  ...c, nameLen: c.name.length, tickerLen: c.ticker.length, storyLen: story.length, descLen: c.description.length,
  endsWithDisclosure: c.description.endsWith(disc), tickerFormat: cr.TICKER.test(c.ticker),
  checkProposal: cr.checkProposal({ name: c.name, symbol: c.ticker, tagline: story }),
  displaySafe: cr.displaySafe({ name: c.name, symbol: c.ticker }),
  checkFieldsStoryLook: cr.checkFields({ story, look: c.look }),
  checkFieldsFull: cr.checkFields({ name: c.name, symbol: c.ticker, description: c.description }),
  checkTerms: cr.checkTerms({ name: c.name, symbol: c.ticker, story, look: c.look }, { stock: stockTerms }),
};
console.log(JSON.stringify(r, null, 1));
