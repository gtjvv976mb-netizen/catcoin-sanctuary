const { checkProposal, checkFields, checkTerms, displaySafe } = await import("/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs");
const DISC = "A cat coin priced in NVDAx. Not affiliated with NVIDIA Corporation or StonkFun. No intrinsic value; not financial advice.";
const coins = [
  { name: "Dewdrop the Sunrise Cat", symbol: "DEWDROP", body: "Dewdrop is a lean grey tabby with a white chin, white bib and four white socks. Each sunrise she tiptoes over the wet lawn, leaving paw prints in the dew." },
  { name: "Sockfoot the Garden Tabby", symbol: "SOCKFOOT", body: "Sockfoot is a grey tabby in four white socks and a white bib. At first light he strolls the garden path, sniffs each flower bed, then naps on warm stones." },
  { name: "Splashdash the Lawn Cat", symbol: "SPLASHDASH", body: "Splashdash is a sleek grey tabby with a white muzzle and snowy paws. When the sprinklers pop up she darts off, shakes dry and trots back to purr." },
];
const stockTerms = { stock: ["NVDA", "NVDAX", "NVDAx", "NVD", "NVIDIA", "Nvidia Corporation", "Jensen", "Huang", "GeForce", "RTX", "GTX", "Jetson", "CUDA", "cuDNN", "Caffe", "GANimal", "StyleGAN", "GauGAN", "Cat Chaser", "Chaser", "Dawn", "Dusk", "Nalu", "Medusa", "Nemotron", "Blackwell", "Hopper", "Rubin", "Vera", "Grace", "Omniverse", "Cosmos", "Isaac", "DGX", "HGX", "Shield", "Tegra", "Titan", "Spark", "Orin", "Thor", "Drive", "Clara", "Riva", "Maxine", "Broadcast", "Reflex", "Ampere", "Turing", "Pascal", "Volta", "Kepler", "Maxwell", "Fermi", "Tesla", "Ada Lovelace", "Lovelace", "Mellanox", "Jaguar", "Land Rover", "Caterpillar", "Backed", "xStock", "Nivi", "LSUN"] };
const out = [];
for (const c of coins) {
  const description = c.body + " " + DISC;
  const r = {
    name: c.name, symbol: c.symbol, nameLen: c.name.length, bodyLen: c.body.length, descLen: description.length,
    checkProposal: checkProposal({ name: c.name, symbol: c.symbol, tagline: c.body }),
    displaySafe: displaySafe({ name: c.name, symbol: c.symbol }),
    checkFieldsFullDescription: checkFields({ description }),
    checkTermsStock: checkTerms({ name: c.name, symbol: c.symbol, description: c.body }, stockTerms),
    description,
  };
  out.push(r);
  console.log(JSON.stringify(r));
}
(await import("node:fs")).writeFileSync("NVDAX-check.out.json", JSON.stringify(out, null, 2));
