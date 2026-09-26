// Simulated research rows for all 24 pairs, built from stockcats/notes/<SYMBOL>.md and the term lists the
// per-stock checkers used. The repo's STOCK_CAT_NOTES ships empty, so these exist only to run the repo's
// stockCatRefusals (pair_term + other_pair across the whole collection). `extra` = own-stock words the
// per-stock checkers also tested with checkTerms (products, codenames, fan names) but that are too generic
// to put in a row.
const day = "2026-09-25";
const row = (people, mascots, brands, extra = []) => ({ people, mascots, brands, extra });
export const ROWS = {
  "SPYx": row([], [], ["SPDR", "State Street", "SSGA", "S&P 500", "Standard and Poors", "Fearless Girl"], ["spider", "clipper", "SP500"]),
  "QQQx": row([], [], ["Invesco", "Nasdaq-100", "NDX", "NAS100", "US100", "Ama Dablam"], ["Cubes", "Trust", "Series"]),
  "GLDx": row([], [], ["SPDR", "SPDR Gold Shares", "SPDR Gold Trust", "State Street", "SSGA", "World Gold Council", "WGC"], ["spider", "Gold xStock"]),
  "TSLAx": row(["Elon Musk", "Musk", "Elon"], [], ["Tesla", "Pet Mode", "Dog Mode", "Camp Mode", "Cybertruck", "Cybercab", "Optimus", "Model S", "Model Y"], ["Plaid", "Ludicrous", "Taco", "balloon cat", "Cheetah Stance", "Schrodinger", "Grok"]),
  "NVDAx": row(["Jensen Huang", "Jensen", "Huang"], ["Dawn", "Nalu"], ["NVIDIA", "GeForce", "RTX", "GTX", "Jetson", "CUDA", "Blackwell", "Omniverse", "Tegra", "DGX", "StyleGAN", "GANimal"], ["Hopper", "Ampere", "Grace", "Rubin", "Cat Chaser", "Caffe", "Robert Bond"]),
  "AAPLx": row(["Tim Cook", "Steve Jobs", "Wozniak"], ["Animoji", "Memoji"], ["Apple", "iPhone", "iPad", "iMac", "macOS", "OS X", "iCloud", "Rosetta", "Siri", "Snow Leopard", "Mountain Lion"], ["Mac", "Safari", "Aqua", "Jaguar", "Panther", "Tiger", "Leopard", "Lion", "Cheetah", "Puma", "Think Different"]),
  "MSFTx": row(["Satya Nadella", "Nadella", "Bill Gates"], ["Clippy", "Ninja Cat", "Octocat", "Mona", "Jellie"], ["Microsoft", "Windows", "Xbox", "GitHub", "Minecraft", "Mojang", "Bethesda", "Khajiit", "LinkedIn", "Azure", "Copilot"], ["Gates", "Scar", "Ocelot", "Grumpy", "Grumpy Cat"]),
  "GOOGLx": row(["Sundar Pichai", "Pichai", "Larry Page", "Sergey Brin"], ["Momo", "Magic Cat Academy"], ["Google", "Alphabet", "YouTube", "Android", "Chrome", "Gemini", "Waymo"], ["Doodle", "wand", "witch", "ghost", "broom", "Halloween", "panther", "cheetah", "lynx", "felix"]),
  "AMZNx": row(["Jeff Bezos", "Andy Jassy", "Bezos", "Jassy"], ["Leo the Lion", "Leo", "Hello Kitty"], ["Amazon MGM Studios", "MGM", "Metro-Goldwyn-Mayer", "Prime", "Prime Video", "Alexa", "Kindle", "Echo", "Kuiper", "Amazon Leo", "Whiskas", "Ember", "Smile", "Amazon Pay"], ["roar", "lion"]),
  "METAx": row(["Mark Zuckerberg", "Zuckerberg", "Zuck", "Yann LeCun", "LeCun"], ["Pusheen", "Jolly", "Beast"], ["Meta", "Facebook", "Instagram", "WhatsApp", "Messenger", "Threads", "Oculus", "Llama", "Make-A-Video", "Meta AI"], ["Quest", "Horizon", "Muse", "Menlo Park"]),
  "COINx": row(["Brian Armstrong"], ["Mister Miggles", "Mr. Miggles", "Miggles", "Toshi", "Mochi", "Keyboard Cat"], ["Coinbase", "Base", "Coinbase Wallet"], ["Satoshi", "Onchain", "KEYCAT", "Jack Begert"]),
  "HOODx": row(["Vlad Tenev", "Tenev", "Baiju Bhatt", "Bhatt"], ["Pixel Cat", "Cash Cat", "CashCat", "Robin Hood"], ["Robinhood", "Robinhood Chain", "Robinhood Legend", "Sherwood"], ["Robin", "feather", "archer", "arrow", "Roaring Kitty"]),
  "MSTRx": row(["Michael Saylor", "Saylor", "Phong Le"], ["Hank"], ["Strategy", "MicroStrategy", "STRK", "STRF", "STRD", "STRE", "Bitcoin"], ["BTC", "sats", "laser eyes"]),
  "CRCLx": row(["Jeremy Allaire", "Allaire", "Sean Neville"], ["Fat Cat Bat Rat", "Cat Bat Hat Fat Rat", "FatCatBatRatWifHat", "UpSideDownCat", "USDCat", "Argus Cat", "ARCAT", "BEANCAT", "Bean Cat"], ["Circle", "Circle Internet Group", "USDC", "USD Coin", "EURC", "Arc", "CCTP", "Circle Mint", "Chelsea", "Chelsea FC"], ["wifhat"]),
  "SPCXx": row(["Elon Musk", "Musk", "Elon", "Gwynne Shotwell", "Shotwell", "Aaron Taylor", "Schrodinger", "Marvin", "Gatsby"], ["Cat 5", "Cat5", "Dishy McFlatface", "Dishy", "Starman", "Aurora"], ["SpaceX", "Space Exploration Technologies", "Starlink", "Starshield", "Falcon", "Dragon", "Starship", "Starbase", "Raptor", "Merlin", "xAI", "Grok"], ["Tippen", "Mars", "rocket", "orbit", "satellite"]),
  "PLTRx": row(["Alex Karp", "Karp", "Peter Thiel", "Thiel"], [], ["Palantir", "Gotham", "Foundry", "Apollo", "AIP", "MetaConstellation", "Maven", "palantiri", "seeing stone"], ["TITAN", "Skykit", "Tiberius", "Tolkien", "Lynx"]),
  "GMEx": row(["Ryan Cohen", "Keith Gill", "Roaring Kitty", "DeepFuckingValue", "DFV"], [], ["GameStop", "Game Stop", "EB Games", "Game Informer", "Power Up"], ["Cat Quest", "Taco Cats", "Chewy", "HODL", "Stonk", "Headband", "WSB", "Ape"]),
  "STRCx": row(["Michael Saylor", "Saylor", "Phong Le"], ["Maxi", "Hank", "honey badger"], ["Strategy", "MicroStrategy", "Stretch", "STRK", "STRF", "STRD", "STRE", "Bitcoin"], ["badger", "BTC", "sats", "satoshi", "laser eyes"]),
  "MCDx": row(["Chris Kempczinski", "Kempczinski", "Ray Kroc", "Kroc"], ["Ronald McDonald", "Grimace", "Hamburglar", "Hello Kitty", "Godzilla", "Birdie"], ["McDonald's", "Big Mac", "McFlurry", "McNugget", "Happy Meal", "Golden Arches", "CosMc's", "Maccas"], ["Ronald", "Kitty White", "Sanrio", "Kaiju"]),
  "BRK.Bx": row(["Warren Buffett", "Buffett", "Charlie Munger", "Munger", "Greg Abel", "Ajit Jain"], ["Cam the Cat", "Cam", "Jack the Black Cat", "Squishmallows", "Hello Kitty", "Garfield", "Gecko"], ["Berkshire", "Hathaway", "GEICO", "Dairy Queen", "Blizzard", "See's Candies", "Duracell", "BNSF", "Jazwares", "Alleghany", "Fruit of the Loom", "Brooks", "Acme Brick", "Omaha"], ["Snowball", "Super-Cat"]),
  "KOx": row(["James Quincey", "Quincey", "Henrique Braun", "Taylor Swift", "Olivia Benson", "Meredith Grey", "Benjamin Button"], ["Simba"], ["Coca-Cola", "Coke", "Diet Coke", "Sprite", "Fanta", "Get A Taste", "Kochakaden"], ["Kittens", "polar bear", "Scottish Fold"]),
  "INTCx": row(["Lip-Bu Tan", "Pat Gelsinger", "Gelsinger", "Audrey Plonk"], ["Update Cat", "UpdateMeow", "Bunny People", "Waffles the Cat", "Cole and Marmalade"], ["Intel", "Intel Inside", "Pentium", "Xeon", "Wildcat Lake", "Tiger Lake", "Panther Lake", "Jaguar Shores", "Lion Cove"], ["Core", "Wildcat", "Tiger", "Panther", "Jaguar", "Lion", "Cougar", "Bobcat", "Waffles", "Marmalade"]),
  "VIDAx": row(["Lyle Pratt", "Brandon Robinson", "Noah Hayes", "Mark Lilien", "Jordan Gadapee"], ["Alice"], ["Vida Global", "Vida AI", "vida.io", "Agent OS"], ["CTO", "headset"]),
  "DFDVx": row(["Joseph Onorati", "Onorati", "Parker White"], ["Chad"], ["DeFi Development", "DeFi Dev Corp", "dfdvSOL", "DisclaimerCoin", "Treasury Accelerator", "Janover"], ["DeFi", "DDC", "Solana", "BONK", "DONT", "ZeroStack"]),
};
export function notesFor(STOCK_PAIRS) {
  return STOCK_PAIRS.map((p) => {
    const r = ROWS[p.symbol];
    if (!r) throw new Error("no row for " + p.symbol);
    return { mint: p.mint, people: r.people, mascots: r.mascots, brands: r.brands,
      catFacts: [{ text: "see notes", source: `stockcats/notes/${p.stonkfun}.md`, readAt: day }], searchedAt: day, method: "editor simulation from notes + per-stock checker lists" };
  });
}
