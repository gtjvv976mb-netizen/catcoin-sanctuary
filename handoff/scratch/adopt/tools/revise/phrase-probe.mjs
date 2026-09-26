import { checkFields, checkTerms } from "/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs";
import { LAUNCH_CLAIMS } from "/home/user/Cat-Intelligence-Agency/src/lib/stockcats.mjs";
for (const t of ["I am its creator; creator fees may be paid to me.", "I'm its creator, so fees may come to me.", "I'm its creator and may get creator fees.", "Run by its adopter.", "not an animal charity", "None launched yet; anything called PATCHPAW before then is not this cat.", "a memecoin anyone can launch", "No coin exists yet", "No memecoin exists yet", "earn", "NFA", "Launched by its adopter's own wallet; Sanctuary does not vet adopters."]) {
  console.log(JSON.stringify(t), JSON.stringify([...checkFields({ t }).violations, ...checkTerms({ t }, { launch_claim: LAUNCH_CLAIMS, pair_term: ["COIN", "COINx", "Coinbase"] }).violations]));
}
