# id: (catName, category, owner, keys-for-dex, wiki titles, suggestedName, ticker, pair, sensitivity, story, look, virality 1-10, realCat)
C = {}
def c(id, **k): C[id] = k

# ---------------- celebrities & personalities ----------------
c('meredith', catName='Meredith Grey', category='celebrity', owner='Taylor Swift', keys=['Meredith Grey','Meredith Swift'], wiki=['Taylor Swift'],
  name='Meredith Grey Swift', ticker='MEREDITH', pair='STONK', viral=9, real=True,
  sens='Real pet of a living celebrity; avoid implying endorsement by Taylor Swift. Name also references the Grey\'s Anatomy character (ABC/Disney trademark context).',
  story="Meredith Grey is Taylor Swift's Scottish Fold, adopted in late 2011 and named after the Grey's Anatomy lead. She appeared in Swift's Diet Coke and Keds ads and is famous for her aloof, 'sassy' posture. People reported her rare 2025 appearance after Swift bought back her masters.",
  look="Scottish Fold: small folded ears, round face; pale grey/silver-white coat with soft grey shading on the head, back and tail; large round amber-copper eyes; no accessories.")
c('benjamin', catName='Benjamin Button', category='celebrity', owner='Taylor Swift', keys=['Benjamin Button cat','Benjamin Swift','Benjamin Button'], wiki=['Taylor Swift'],
  name='Benjamin Button Swift', ticker='BENBUTTON', pair='STONK', viral=9, real=True,
  sens='Real pet of a living celebrity; no endorsement implied. Name references the F. Scott Fitzgerald story/film.',
  story="Benjamin Button is Taylor Swift's Ragdoll, introduced in her 2019 'ME!' video and draped over her shoulders on TIME's 2023 Person of the Year cover. Swift joked on X: 'Can I bring my cat.'",
  look="Ragdoll: medium-long silky coat, cream-white body with seal/brown-grey colorpoint on the face mask, ears and tail, faint pointed legs; vivid blue eyes; no collar.")
c('dorito-calippo', catName='Dorito & Calippo', category='celebrity', owner='Ed Sheeran', keys=['Calippo','Dorito and Calippo'], wiki=['Ed Sheeran'],
  name='Dorito and Calippo', ticker='CALIPPO', pair='STONK', viral=6, real=True,
  sens='Real pets of a living musician; no endorsement implied. "Calippo" is a Unilever ice-lolly trademark and "Dorito" a PepsiCo trademark: use as cat names only.',
  story="Dorito and Calippo are Ed Sheeran's two cats; in 2018 he created a dedicated Instagram account for them (reported by radio and entertainment media). Calippo is the ginger one, Dorito the other; both lived with Sheeran and Cherry Seaborn in Suffolk.",
  look="Two cats: Calippo a ginger/orange tabby with white chest; Dorito a (reported) grey-and-white/tabby cat; ordinary domestic shorthairs, green-yellow eyes. Use photos from the cats' account before finalizing Dorito's coat.")
c('bellini', catName='Bellini', category='celebrity', owner='Ed Sheeran', keys=['Bellini cat','Bellini Sheeran'], wiki=[],
  name='Bellini the Trooper Cat', ticker='BELLINI', pair='STONK', viral=3, real=True,
  sens='Real pet of a living musician; thin public record (one 2011 tweet).',
  story="Bellini is an earlier cat of Ed Sheeran; in November 2011 Sheeran tweeted: 'My cat isn't dead though, he's a trooper, he's called Bellini and eats alot.'",
  look="Unknown from public sources; do not invent. Needs a photo before art.")
c('sushi-tuna', catName='Sushi & Tuna', category='celebrity', owner='Justin Bieber', keys=['Sushi and Tuna','Bieber cat','kittysushiandtuna'], wiki=['Justin Bieber'],
  name='Sushi and Tuna Bieber', ticker='SUSHITUNA', pair='STONK', viral=6, real=True,
  sens='Real pets of a living celebrity; the 2019 purchase of exotic Savannah cats drew animal-welfare criticism. Keep neutral.',
  story="In 2019 Justin and Hailey Bieber bought two F2 Savannah kittens, Sushi and Tuna (reported at about $35,000 each), and launched an Instagram for them; Justin posted 'Follow my CAT FAMILY @kittysushiandtuna' and 'Cat dad for life.'",
  look="Two Savannah cats (serval hybrids): tall, long-legged, large upright ears; golden-tan coats with bold black spots; amber-green eyes.")
c('choupette', catName='Choupette', category='celebrity', owner='Karl Lagerfeld (estate)', keys=['Choupette'], wiki=['Choupette'],
  name='Choupette Lagerfeld', ticker='CHOUPETTE', pair='STONK', viral=8, real=True,
  sens='Real cat; owner deceased (2019). Managed by an agent; Chanel/Lagerfeld trademarks—no brand use.',
  story="Choupette is the blue-cream Birman of fashion designer Karl Lagerfeld, who called her 'the center of the world'. She had two maids, travelled by private jet, starred in campaigns (Shu Uemura, Hublot) and was named among his heirs. The Atlantic and Telegraph covered her life after his 2019 death.",
  look="Birman: long silky white-cream coat, blue-cream points on face, ears and tail, white 'gloved' paws; deep sapphire-blue eyes; often shown on luxury cushions.")
c('pickle', catName='Pickle', category='celebrity', owner='Ricky Gervais', keys=['Pickle Gervais','Gervais cat'], wiki=[],
  name='Pickle the Gervais Cat', ticker='PICKLECAT', pair='STONK', viral=6, real=True,
  sens='Real pet of a living comedian; no endorsement implied.',
  story="Pickle is Ricky Gervais's rescue cat, a 'foster fail' from Feline Friends UK in October 2020. Gervais tweeted 'We've named her Pickle' and later the running joke 'Just so we're clear, Pickle is the name of my cat.'",
  look="Black-and-white tuxedo cat with a white chest, white paws and a white muzzle patch; green-yellow eyes. Verify against Gervais's photos.")
c('ollie', catName='Ollie', category='celebrity', owner='Ricky Gervais', keys=['Ollie Gervais','Ollie cat'], wiki=[],
  name='Ollie the Gervais Cat', ticker='OLLIECAT', pair='STONK', viral=5, real=True,
  sens='Deceased pet (died March 2020) of a living comedian; handle with care.',
  story="Ollie was Ricky Gervais's beloved cat, a frequent star of his tweets ('Ollie has done f*** all today'). She died in March 2020; Entertainment Weekly covered his tribute and he posted her last photo on International Cat Day.",
  look="Grey-and-white long-haired cat (fluffy, white chest and paws, grey back and head); green eyes. Verify against Gervais's photos.")
c('kittypurry', catName='Kitty Purry', category='celebrity', owner='Katy Perry', keys=['Kitty Purry'], wiki=['Katy Perry'],
  name='Kitty Purry', ticker='KPURRY', pair='STONK', viral=7, real=True,
  sens='Deceased pet (died 2020) of a living singer; Katy Perry\'s fan club is also called "Kitty Purry"; avoid implying endorsement.',
  story="Kitty Purry was Katy Perry's grey tabby, adopted around 2008; she gave her name to Perry's fan club and appeared in the 'Hot n Cold' era. Perry tweeted 'IT'S OKAY HELLO KITTY FANS, KITTY PURRY IS A CAT.' Pop Crave reported her death in April 2020.",
  look="Silver-grey classic tabby with darker grey stripes, white muzzle hints; green eyes; ordinary domestic shorthair.")
c('empresstang', catName='Empress Tang', category='celebrity', owner='Martha Stewart', keys=['Empress Tang'], wiki=[],
  name='Empress Tang', ticker='EMPTANG', pair='STONK', viral=4, real=True,
  sens='Real pet of a living TV personality; no endorsement implied.',
  story="Empress Tang is one of Martha Stewart's Himalayan cats. In April 2020 Stewart tweeted that Empress Tang had 'gone a little crazy during this crisis', following her everywhere and meowing constantly.",
  look="Himalayan: long fluffy cream coat with darker seal/chocolate points on face, ears and tail; flat face; blue eyes.")
c('delilah', catName='Delilah', category='celebrity', owner='Freddie Mercury', keys=['Delilah cat','Delilah Mercury'], wiki=['Delilah (Queen song)'],
  name='Delilah Mercury', ticker='DELILAH', pair='STONK', viral=7, real=True,
  sens='Historic pet; owner deceased (1991). Queen song/brand trademarks: no band branding.',
  story="Delilah was Freddie Mercury's favourite of his many cats at Garden Lodge, London. He wrote the Queen song 'Delilah' (Innuendo, 1991) about her, and Sotheby's featured his cats in its 2023 Mercury auction.",
  look="Tortoiseshell-and-white (calico) domestic cat: white chest and paws, patches of black and ginger on back and head; green-gold eyes.")
c('morrissey', catName='Morrissey', category='celebrity', owner='Russell Brand', keys=['Morrissey cat'], wiki=[],
  name='Morrissey the Brand Cat', ticker='MOZCAT', pair='STONK', viral=4, real=True,
  sens='Deceased pet (2020); owner is a living person facing serious allegations (2023–25). High reputational sensitivity: consider not listing.',
  story="Morrissey was Russell Brand's long-time cat, named after the singer. Brand announced 'My cat Morrissey died' in April 2020 with a video tribute.",
  look="Grey-and-white long-haired cat; verify with photos before art.")
c('lisa-leo', catName='Leo (Lisa\'s cat)', category='celebrity', owner='Lisa (BLACKPINK)', keys=['Leo Manoban','Lisa cat Leo'], wiki=[],
  name='Leo of Lalisa', ticker='LALEO', pair='STONK', viral=7, real=True,
  sens='Real pet of a living K-pop star; no endorsement implied; "BLACKPINK" is a YG trademark.',
  story="Leo is the Scottish Fold cat of BLACKPINK's Lisa (Lalisa Manoban), often called 'the owl' by fans; he appears in her Instagram and has his own fan following. Media such as Koreaboo and Clout News have featured Lisa's photos with Leo.",
  look="Scottish Fold: tiny folded ears, very round owl-like face; silver-grey tabby coat with white; big round amber-copper eyes.")
c('lisa-luca', catName='Luca (Lisa\'s cat)', category='celebrity', owner='Lisa (BLACKPINK)', keys=['Luca Lisa cat','Luca Manoban'], wiki=[],
  name='Luca of Lalisa', ticker='LALUCA', pair='STONK', viral=5, real=True,
  sens='Real pet of a living K-pop star; fan-account sourcing; no endorsement implied.',
  story="Luca is one of BLACKPINK Lisa's cats (with Leo, Lily, Louis); fans call him her 'handsome' cat and Lily is his daughter.",
  look="Munchkin-type long-haired cat, grey/brown tabby with white; round eyes. Verify with Lisa's photos.")
c('lisa-louis', catName='Louis (Lisa\'s cat)', category='celebrity', owner='Lisa (BLACKPINK)', keys=['Louis cat','Louis Manoban'], wiki=[],
  name='Louis of Lalisa', ticker='LALOUIS', pair='STONK', viral=5, real=True,
  sens='Real pet of a living K-pop star; fan-account sourcing only.',
  story="Louis is one of BLACKPINK Lisa's cats, called her 'fat cat' by fans, alongside Leo, Luca and Lily.",
  look="Chunky long-haired cat; verify coat with Lisa's photos before art.")
c('willard', catName='F.D.C. Willard (Chester)', category='celebrity', owner='Jack H. Hetherington (physicist)', keys=['FDC Willard','Chester Willard','Willard cat'], wiki=['F. D. C. Willard'],
  name='FDC Willard Physicist Cat', ticker='FDCW', pair='STONK', viral=6, real=True,
  sens='Historic cat (1970s); owner deceased.',
  story="Chester, a Siamese, became 'F. D. C. Willard' when physicist Jack Hetherington listed him as co-author of a 1975 Physical Review Letters paper to avoid rewriting 'we'. The American Physical Society celebrates him as the only feline co-author in physics history.",
  look="Siamese: cream body, seal-brown points on face, ears, paws and tail; slender; blue eyes.")
c('jock', catName='Jock', category='celebrity', owner='Winston Churchill / National Trust (Chartwell)', keys=['Jock cat','Jock Chartwell','Churchill cat'], wiki=['Chartwell'],
  name='Jock of Chartwell', ticker='JOCKCAT', pair='STONK', viral=5, real=True,
  sens='Historic (Churchill\'s cat) plus a living resident cat (Jock VII) at a National Trust property.',
  story="Winston Churchill's marmalade cat Jock was given to him in 1962; the family asked that a marmalade cat named Jock always live at Chartwell. The National Trust keeps the tradition: Jock VII arrived in 2020.",
  look="Marmalade (ginger) tabby with white bib and white paws; amber eyes.")
c('trim', catName='Trim', category='celebrity', owner='Matthew Flinders (explorer)', keys=['Trim cat','Trim Flinders'], wiki=['Trim (cat)'],
  name='Trim the Navigator Cat', ticker='TRIMCAT', pair='STONK', viral=4, real=True,
  sens='Historic cat (1799–1804).',
  story="Trim was the ship's cat of explorer Matthew Flinders, who sailed with him on the first circumnavigation of Australia (1801–03). Flinders wrote a tribute to him; statues of Trim stand in Sydney and at London's Euston station.",
  look="Black cat with white chest star, white paws and white chin; yellow-green eyes.")
c('willow', catName='Willow', category='celebrity', owner='Jill & Joe Biden (First Family)', keys=['Willow Biden','First Cat Willow'], wiki=['Willow (cat)'],
  name='Willow the First Cat', ticker='WILLOWCAT', pair='STONK', viral=7, real=True,
  sens='Political figure\'s pet (US President 2021–25); keep strictly non-partisan.',
  story="Willow is a grey tabby farm cat who jumped on stage during Jill Biden's 2020 campaign speech in Pennsylvania. She moved into the White House in January 2022 as First Cat, named after Willow Grove, PA.",
  look="Grey tabby with dark stripes, white-grey muzzle, green eyes; short hair.")
c('socks', catName='Socks', category='celebrity', owner='Bill & Hillary Clinton (First Family)', keys=['Socks cat','Socks Clinton'], wiki=['Socks (cat)'],
  name='Socks the First Cat', ticker='SOCKSCAT', pair='STONK', viral=6, real=True,
  sens='Deceased (2009) pet of a political family; keep non-partisan.',
  story="Socks was the Clinton family's tuxedo cat and White House First Cat (1993–2001). He posed at the press-room podium, sat behind the Oval Office desk and received thousands of children's letters.",
  look="Black-and-white tuxedo cat with four white 'socks' paws, white chest and white chin; yellow-green eyes.")

# ---------------- company / institution office cats & mascots ----------------
c('larry', catName='Larry', category='company', owner='UK Cabinet Office (10 Downing Street)', keys=['Larry the cat','Larry Downing'], wiki=['Larry (cat)'],
  name='Larry the Chief Mouser', ticker='LARRY10', pair='STONK', viral=9, real=True,
  sens='Government institution cat; the @Number10cat X account is a parody, not official. Keep non-partisan.',
  story="Larry, a brown-and-white tabby from Battersea, has been Chief Mouser to the Cabinet Office at 10 Downing Street since February 2011, outlasting several Prime Ministers; CBS reported him awaiting his seventh PM in 2026.",
  look="Brown tabby-and-white: white chest, belly and paws, brown mackerel tabby back and head; green-yellow eyes.")
c('palmerston', catName='Palmerston', category='company', owner='UK Foreign Office (FCDO)', keys=['Palmerston'], wiki=['Palmerston (cat)'],
  name='Palmerston the DiploMog', ticker='DIPLOMOG', pair='STONK', viral=6, real=True,
  sens='Government institution cat; retired 2020 (reported to have died 2025). Keep non-partisan.',
  story="Palmerston, a black-and-white Battersea rescue, became the Foreign Office's Chief Mouser in April 2016, named after the long-serving Foreign Secretary; he retired to Bermuda in 2020. Sky News covered his start.",
  look="Black-and-white tuxedo: black back and head, white chest, muzzle and paws; yellow eyes.")
c('gladstone', catName='Gladstone', category='company', owner='HM Treasury', keys=['Gladstone cat'], wiki=['Gladstone (cat)'],
  name='Gladstone the Treasury Cat', ticker='TREASMOG', pair='STONK', viral=5, real=True,
  sens='Government institution cat.',
  story="Gladstone is the Chief Mouser to HM Treasury, a Battersea rescue appointed in 2016; HM Treasury itself posted about his first year in the spotlight.",
  look="Black cat with a small white chest patch; yellow-green eyes; sleek short coat.")
c('ossie', catName='Ossie', category='company', owner='UK Cabinet Office', keys=['Ossie cat'], wiki=[],
  name='Ossie the Cabinet Cat', ticker='OSSIE', pair='STONK', viral=4, real=True,
  sens='Government institution cat.',
  story="Ossie and his mother Evie are the Cabinet Office cats in Whitehall. The Cabinet Office posted Ossie 'annoyed' about a Christmas jumper, and The Sun reported in 2026 that civil servants raised money for his surgery after he fell off a cabinet.",
  look="Black-and-white cat (tuxedo) — verify against Cabinet Office photos.")
c('jonesy-dummy', catName='', category='x', owner='', keys=[], wiki=[], name='', ticker='', pair='', viral=0, real=False, sens='', story='', look='')
del C['jonesy-dummy']
c('felixhudds', catName='Felix', category='company', owner='TransPennine Express (Huddersfield station)', keys=['Felix station cat','Felix Huddersfield'], wiki=['Felix (cat)'],
  name='Felix of Huddersfield Station', ticker='FELIXHUD', pair='STONK', viral=5, real=True,
  sens='Deceased (Dec 2023) workplace cat of a UK train operator (now publicly owned).',
  story="Felix was the Senior Pest Controller at Huddersfield railway station from 2011, with her own staff pass, a book and a large following; TransPennine Express announced her death in December 2023.",
  look="Black-and-white cat with a black face mask, white muzzle and chest, fluffy medium coat; yellow-green eyes; often in a high-vis vest.")
c('tama', catName='Tama', category='company', owner='Wakayama Electric Railway (Kishi Station)', keys=['Tama cat','Tama stationmaster','Station master Tama'], wiki=['Tama (cat)'],
  name='Tama the Stationmaster', ticker='TAMAEKI', pair='STONK', viral=7, real=True,
  sens='Deceased (2015); enshrined as a Shinto goddess—treat respectfully. Railway trademarks.',
  story="Tama, a calico stray, was made stationmaster of unstaffed Kishi Station in 2007; tourism boosted the struggling Kishigawa Line. She was promoted to 'super stationmaster' and VP, and after her 2015 death was enshrined as 'Honourable Eternal Stationmaster'.",
  look="Calico: white body with orange and black patches; amber-green eyes; wears a small navy stationmaster cap with gold badge.")
c('nitama', catName='Nitama', category='company', owner='Wakayama Electric Railway', keys=['Nitama'], wiki=['Nitama'],
  name='Nitama the Stationmaster', ticker='NITAMA', pair='STONK', viral=5, real=True,
  sens='Deceased (Nov 2025); railway trademarks.',
  story="Nitama ('Tama II'), a calico, succeeded Tama as Kishi Station's cat stationmaster and chief priest of the Tama shrine; she died in November 2025 and was honoured with a funeral at the station.",
  look="Calico: white with orange and black patches; wears the navy stationmaster cap.")
c('yontama', catName='Yontama', category='company', owner='Wakayama Electric Railway', keys=['Yontama'], wiki=[],
  name='Yontama the Stationmaster', ticker='YONTAMA', pair='STONK', viral=4, real=True,
  sens='Living workplace cat; railway trademarks.',
  story="Yontama became the new cat stationmaster of Kishi Station in January 2026 after Nitama's death, appointed with a formal ceremony (reported by NEXTA).",
  look="Calico; wears the navy stationmaster cap. Verify coat with railway photos.")
c('towser', catName='Towser', category='company', owner='The Glenturret distillery', keys=['Towser'], wiki=['Towser the Mouser'],
  name='Towser the Mouser', ticker='TOWSER', pair='STONK', viral=4, real=True,
  sens='Historic (d. 1987) distillery cat; alcohol-brand association.',
  story="Towser (1963–1987) was the distillery cat at The Glenturret in Scotland; Guinness World Records credits her as the greatest mouser, with an estimated 28,899 mice. A statue stands at the distillery.",
  look="Long-haired tortoiseshell/tabby cat, brown and ginger mottled coat; amber eyes. Verify with distillery photos.")
c('cc', catName='CC (CopyCat)', category='company', owner='Texas A&M College of Veterinary Medicine', keys=['CopyCat cat','Cloned cat','CC the cat'], wiki=['CC (cat)'],
  name='CC the First Cloned Cat', ticker='COPYCC', pair='STONK', viral=5, real=True,
  sens='Deceased (2020); a coin "Copycat Token" exists on BSC but is unrelated.',
  story="CC ('Carbon Copy') was the world's first cloned pet, born at Texas A&M on 22 December 2001; her coat differed from her calico donor's. She lived a normal life and died in 2020 at 18, as Texas A&M and the AVMA announced.",
  look="White with grey-brown tabby patches on back and head (no orange); green eyes.")
c('felicette', catName='Félicette', category='company', owner='CNES (French space programme)', keys=['Felicette','First cat in space'], wiki=['Félicette'],
  name='Felicette Space Cat', ticker='FELICETTE', pair='STONK', viral=6, real=True,
  sens='Historic animal-testing subject (euthanised after the flight); treat respectfully.',
  story="Félicette (C 341), a Parisian stray, became the only cat launched into space, on a Véronique rocket on 18 October 1963 as part of the French space programme. She survived the flight; CNES promoted her memorial (unveiled 2019).",
  look="Black-and-white tuxedo cat, mostly white with a black cap and back patches; small; green eyes.")
c('jonesy', catName='Jonesy', category='tvmovie', owner='Alien (20th Century Studios / Disney)', keys=['Jonesy'], wiki=['Jonesy'],
  name='Jonesy of the Nostromo', ticker='NOSTROMO', pair='STONK', viral=7, real=False,
  sens='Character from Alien (Disney-owned 20th Century Studios trademark); played by four real ginger cats. An existing JONESY coin is small.',
  story="Jones ('Jonesy') is the Nostromo's ginger ship's cat in Ridley Scott's Alien (1979), rescued by Ripley and the only other survivor; he returns in Aliens (1986). NECA and Dead by Daylight made official Jonesy items.",
  look="Ginger (orange) tabby with white chest, medium coat; amber eyes; often in a small pet carrier.")
c('goose', catName='Goose', category='tvmovie', owner='Marvel Studios (Captain Marvel)', keys=['Goose cat','Goose the Flerken','Flerken'], wiki=['Goose (Marvel Cinematic Universe)'],
  name='Goose the Flerken', ticker='FLERKEN', pair='STONK', viral=7, real=False,
  sens='Marvel/Disney character; played by real cats Reggie, Archie, Rizzo and Gonzo.',
  story="Goose is Carol Danvers' 'cat' in Captain Marvel (2019)—really a Flerken with tentacles in her mouth who scratched out Nick Fury's eye. Marvel's official account explained 'What in the world is a Flerken?'.",
  look="Orange (ginger) tabby with white muzzle and chest, short coat; amber eyes.")
c('bigglesworth', catName='Mr. Bigglesworth', category='tvmovie', owner='Austin Powers (New Line/Warner Bros.)', keys=['Bigglesworth'], wiki=['Mr. Bigglesworth'],
  name='Mr Bigglesworth', ticker='BIGGLES', pair='STONK', viral=7, real=False,
  sens='Film character (Warner Bros./New Line); real actor cat Ted Nude-Gent (Sphynx).',
  story="Mr. Bigglesworth is Dr. Evil's cat in the Austin Powers films: a white Persian who lost his fur after cryo-freezing and became a hairless Sphynx, played by the cat Ted Nude-Gent.",
  look="Hairless Sphynx: pinkish-grey wrinkled skin, large ears, green-blue eyes; alt form a white Persian.")
c('salem', catName='Salem Saberhagen', category='tvmovie', owner='Sabrina the Teenage Witch (Archie Comics)', keys=['Salem Saberhagen','Salem cat'], wiki=['Salem Saberhagen'],
  name='Salem Saberhagen', ticker='SABERHAGEN', pair='STONK', viral=7, real=False,
  sens='Archie Comics character; TV version by Paramount/ABC; animatronic plus real cats.',
  story="Salem Saberhagen is the black talking cat of Sabrina the Teenage Witch—a warlock sentenced to 100 years as a cat for trying to take over the world. The 1996–2003 sitcom made his sarcastic one-liners iconic.",
  look="Solid black short-haired cat, glossy coat, yellow-gold eyes.")
c('crookshanks', catName='Crookshanks', category='tvmovie', owner='Harry Potter (Warner Bros./J.K. Rowling)', keys=['Crookshanks'], wiki=['Magical creatures in Harry Potter'],
  name='Crookshanks', ticker='CROOKSHNK', pair='STONK', viral=7, real=False,
  sens='Warner Bros./Wizarding World trademark; author controversy—avoid author references.',
  story="Crookshanks is Hermione Granger's half-Kneazle cat, bought in Diagon Alley in 1993, who sensed that Ron's rat Scabbers was really Peter Pettigrew. Wizarding World Japan's official account featured him.",
  look="Large ginger Persian-type cat, flat squashed face, bottle-brush tail, slightly bow legs; yellow eyes.")
c('mrsnorris', catName='Mrs Norris', category='tvmovie', owner='Harry Potter (Warner Bros.)', keys=['Mrs Norris'], wiki=['Hogwarts staff'],
  name='Mrs Norris of Hogwarts', ticker='MRSNORRIS', pair='STONK', viral=6, real=False,
  sens='Warner Bros./Wizarding World trademark.',
  story="Mrs Norris is caretaker Argus Filch's watchful cat at Hogwarts, famously Petrified by the basilisk in Chamber of Secrets. Official game Hogwarts Mystery built a quest around her.",
  look="Maine Coon type: dusty grey-brown tabby, scrawny, long fur; lamp-like red-orange eyes.")
c('church', catName='Church', category='tvmovie', owner='Pet Sematary (Stephen King / Paramount)', keys=['Church cat','Pet Sematary cat'], wiki=['Pet Sematary'],
  name='Church of Pet Sematary', ticker='CHURCHCAT', pair='STONK', viral=6, real=False,
  sens='Horror character (resurrected pet); Paramount trademark. 2019 film cat played by Tonic.',
  story="Winston Churchill ('Church') is the Creed family's cat in Stephen King's Pet Sematary, buried in the Micmac ground and returning changed. IGN profiled why he's a horror icon; the 2019 remake cast Tonic, a Maine Coon/Siberian.",
  look="1989 film: grey-and-white British Shorthair; 2019 film: long-haired grey-brown tabby Maine Coon with amber eyes.")
c('tonic', catName='Tonic', category='tvmovie', owner='Melissa Millett (animal trainer)', keys=['Tonic cat'], wiki=[],
  name='Tonic the Actor Cat', ticker='TONICCAT', pair='STONK', viral=4, real=True,
  sens='Living working animal actor; trainer is a private professional.',
  story="Tonic is a Toronto stray-turned-actor trained by Melissa Millett; he played Church in Pet Sematary (2019), Dewey in Thanksgiving (2023) and appeared in Caught Stealing (2025).",
  look="Siberian/Maine Coon-type long-haired brown-grey tabby, bushy tail, lynx-like ear tufts; amber eyes.")
c('orangey', catName='Orangey', category='tvmovie', owner='Frank Inn (trainer)', keys=['Orangey'], wiki=['Orangey'],
  name='Orangey', ticker='ORANGEY', pair='STONK', viral=4, real=True,
  sens='Historic animal actor (1950s–60s).', story='', look='')
c('serpounce', catName='Ser Pounce', category='tvmovie', owner='Game of Thrones (HBO / George R.R. Martin)', keys=['Ser Pounce'], wiki=['Tommen Baratheon'],
  name='Ser Pounce', ticker='SERPOUNCE', pair='STONK', viral=5, real=False,
  sens='HBO/Warner Bros. Discovery trademark.',
  story="Ser Pounce is King Tommen Baratheon's kitten in Game of Thrones and A Song of Ice and Fire; the official House of the Dragon account honoured 'the ancestors of Ser Pounce' in 2026.",
  look="Small black-and-white kitten with green-yellow eyes.")
c('binx', catName='Thackery Binx', category='tvmovie', owner='Hocus Pocus (Disney)', keys=['Thackery Binx','Binx cat'], wiki=['Hocus Pocus (1993 film)'],
  name='Thackery Binx', ticker='THACKERY', pair='STONK', viral=6, real=False,
  sens='Disney character.',
  story="Thackery Binx is the boy cursed by the Sanderson sisters in 1693 to live forever as a black cat in Disney's Hocus Pocus (1993), voiced by Jason Marsden; Funko made an official Binx POP.",
  look="Sleek solid black cat with bright green eyes.")
c('snowbell', catName='Snowbell', category='tvmovie', owner='Stuart Little (Sony Pictures)', keys=['Snowbell'], wiki=['Stuart Little (film)'],
  name='Snowbell', ticker='SNOWBELL', pair='STONK', viral=5, real=False,
  sens='Sony Pictures character; voiced by Nathan Lane; played by real Persian cats.',
  story="Snowbell is the Little family's white Persian in Stuart Little (1999), jealous of the mouse the family adopts, voiced by Nathan Lane.",
  look="White Persian: long fluffy white coat, flat face, blue-green eyes.")
c('jiji', catName='Jiji', category='tvmovie', owner="Kiki's Delivery Service (Studio Ghibli)", keys=['Jiji'], wiki=["Kiki's Delivery Service"], name='Jiji', ticker='JIJI', pair='STONK', viral=8, real=False, sens='', story='', look='')
c('keanu', catName='Keanu', category='tvmovie', owner='Keanu (2016, Warner Bros./New Line)', keys=['Keanu cat','Keanu kitten'], wiki=['Keanu (film)'],
  name='Keanu the Kitten', ticker='KITTENPLZ', pair='STONK', viral=4, real=False,
  sens='Film character; name shared with Keanu Reeves—avoid confusion.',
  story="Keanu is the tabby kitten at the heart of Key & Peele's action comedy Keanu (2016): two cousins pose as gangsters to rescue him ('Kitten, please'). Played by seven kittens.",
  look="Small brown tabby kitten with white chest, big eyes; sometimes wears a tiny do-rag.")
c('jinx', catName='Mr. Jinx', category='tvmovie', owner='Meet the Parents (Universal/DreamWorks)', keys=['Mr Jinx','Jinx cat'], wiki=['Meet the Parents'],
  name='Mr Jinx', ticker='JINXY', pair='STONK', viral=4, real=False,
  sens='Film character; weak X proof (fan post only).',
  story="Mr. Jinx is Jack Byrnes' Himalayan in Meet the Parents (2000), who can use a toilet and gets Greg Focker into trouble ('Jinxy!').",
  look="Himalayan: cream long coat with seal points on face, ears, tail; blue eyes.")
c('orion', catName='Orion', category='tvmovie', owner='Men in Black (Sony/Columbia)', keys=['Orion cat'], wiki=['Men in Black (1997 film)'],
  name='Orion', ticker='ORIONCAT', pair='STONK', viral=5, real=False, sens='Weak X proof (fan design post).', story='', look='')
c('spot', catName='Spot', category='tvmovie', owner='Star Trek (Paramount)', keys=['Spot cat','Spot Data'], wiki=['Spot (Star Trek)'],
  name='Spot', ticker='SPOTCAT', pair='STONK', viral=4, real=False, sens='', story='', look='')
c('figaro', catName='Figaro', category='tvmovie', owner='Pinocchio (Disney)', keys=['Figaro cat'], wiki=['Figaro (Disney)'],
  name='Figaro', ticker='FIGAROCAT', pair='STONK', viral=6, real=False, sens='Disney character.',
  story="Figaro is Geppetto's tuxedo kitten in Disney's Pinocchio (1940). Walt Disney liked him so much he became Minnie Mouse's cat in later shorts, as the Walt Disney Family Museum notes.",
  look="Black-and-white tuxedo kitten: black back and head, white muzzle, chest, paws and tail tip; blue-green eyes.")
c('lucifer', catName='Lucifer', category='tvmovie', owner='Cinderella (Disney)', keys=['Lucifer cat'], wiki=['Lucifer (Disney)'],
  name='Lucifer of Tremaine Manor', ticker='TREMAINE', pair='STONK', viral=6, real=False, sens='Disney character; the name has religious connotations.',
  story="Lucifer is Lady Tremaine's scheming cat in Disney's Cinderella (1950). Animator Ward Kimball modelled him on his own plump six-toed calico, Feetsy; he is hidden twice around Cinderella Castle at Magic Kingdom.",
  look="Plump black-and-grey cat with a white chest and muzzle, big green eyes, sly grin.")
c('marie', catName='Marie', category='tvmovie', owner='The Aristocats (Disney)', keys=['Marie Aristocats','Aristocats'], wiki=['The Aristocats'],
  name='Marie of the Aristocats', ticker='MARIEAC', pair='STONK', viral=7, real=False, sens='Disney character.',
  story="Marie is Duchess's only daughter in Disney's The Aristocats (1970), the last animated feature approved by Walt Disney. Marie has become a Disney merchandise favourite and a Disneyland Paris kiosk namesake.",
  look="White Turkish-Angora-type kitten, fluffy, pink bow on her head and a pink neck bow; blue eyes.")
c('cheshire', catName='Cheshire Cat', category='tvmovie', owner='Alice in Wonderland (Lewis Carroll; Disney film)', keys=['Cheshire cat'], wiki=['Cheshire Cat'],
  name='Cheshire Grin Cat', ticker='CHESHIRE', pair='STONK', viral=7, real=False, sens='Public-domain literary character (Carroll); Disney design is trademarked—use a non-Disney look.',
  story="The Cheshire Cat is the grinning, disappearing cat from Lewis Carroll's Alice's Adventures in Wonderland (1865), made iconic by Disney's 1951 film and the 2010/2016 live-action films.",
  look="Striped magenta-and-pink tabby with a huge toothy grin and yellow eyes (Disney); for a public-domain look, Tenniel's striped tabby grin.")
c('tibbs', catName='Sergeant Tibbs', category='tvmovie', owner='One Hundred and One Dalmatians (Disney)', keys=['Sergeant Tibbs'], wiki=["One Hundred and One Dalmatians"],
  name='Sergeant Tibbs', ticker='SGTTIBBS', pair='STONK', viral=4, real=False, sens='Disney character.',
  story="Sergeant Tibbs is the brave tabby cat in Disney's One Hundred and One Dalmatians (1961) who finds the stolen puppies at Hell Hall; voiced by David Frankham.",
  look="Orange-and-cream tabby with white muzzle, slightly tufted; yellow eyes.")
c('azrael', catName='Azrael', category='tvmovie', owner='The Smurfs (Peyo / IMPS)', keys=['Azrael cat'], wiki=['Azrael (The Smurfs)'],
  name='Azrael', ticker='AZRAELCAT', pair='STONK', viral=5, real=False, sens='IMPS/Peyo trademark; name references the angel of death.',
  story="Azrael is Gargamel's scruffy ginger cat in Peyo's The Smurfs, forever hunting Smurfs; the official Smurfs movie account called him 'the world's most over-it cat'.",
  look="Scrawny ginger/orange cat with a torn ear, yellow eyes, scruffy tail.")
c('snowball', catName='Snowball II', category='tvmovie', owner='The Simpsons (Disney/20th Television)', keys=['Snowball II','Snowball cat'], wiki=['Simpson family'],
  name='Snowball II', ticker='SNOWBALL2', pair='STONK', viral=6, real=False, sens='Disney/20th Television trademark.',
  story="Snowball II is Lisa Simpson's black cat in The Simpsons; the official account recalled his 'straycation' on #CatDay. Several Snowballs came and went, with the name resetting each time.",
  look="Solid black cat with yellow eyes.")
c('gumball', catName='Gumball Watterson', category='tvmovie', owner='The Amazing World of Gumball (Cartoon Network / WBD)', keys=['Gumball Watterson'], wiki=['Gumball Watterson'],
  name='Gumball Watterson', ticker='GUMBALLW', pair='STONK', viral=6, real=False, sens='WBD trademark; character is a 12-year-old cartoon cat.',
  story="Gumball Watterson is the blue 12-year-old cat star of Cartoon Network's The Amazing World of Gumball (2011–19), revived as The Wonderfully Weird World of Gumball (2025).",
  look="Cartoon blue cat, round head, white muzzle, big eyes; grey sweater. Stylised.")
c('stimpy', catName='Stimpy', category='tvmovie', owner='The Ren & Stimpy Show (Nickelodeon/Paramount)', keys=['Stimpy'], wiki=['Ren and Stimpy'],
  name='Stimpson J Cat', ticker='STIMPSON', pair='STONK', viral=5, real=False, sens='Paramount trademark; creator controversy—avoid creator references.', story="", look="")
c('heathcliff', catName='Heathcliff', category='tvmovie', owner='Heathcliff comic (George Gately)', keys=['Heathcliff cat'], wiki=['Heathcliff (comics)'],
  name='Heathcliff the Alley Cat', ticker='HEATHCAT', pair='STONK', viral=4, real=False, sens='Comic-strip trademark.',
  story="Heathcliff is George Gately's orange troublemaking alley cat, a daily comic strip since 1973 (now by Peter Gallagher) with 1980s cartoons.",
  look="Orange cat with dark stripes, a tuft of hair on his head, half-closed smug eyes.")
c('felixcat', catName='Felix the Cat', category='tvmovie', owner='Felix the Cat (Otto Messmer / DreamWorks Classics)', keys=['Felix the Cat'], wiki=['Felix the Cat'],
  name='Felix the Silent Star', ticker='FELIX1919', pair='STONK', viral=6, real=False, sens='Trademark of DreamWorks Classics (Comcast); early shorts public domain.',
  story="Felix the Cat debuted in Feline Follies on 9 November 1919 and became the first animated megastar; Cartoon Brew marked his 100th birthday.",
  look="Black cartoon cat with white face mask, big eyes and wide grin; sometimes his Magic Bag of Tricks.")
c('sylvester', catName='Sylvester', category='tvmovie', owner='Looney Tunes (Warner Bros.)', keys=['Sylvester cat'], wiki=['Sylvester the Cat'],
  name='Sufferin Sylvester', ticker='SUCCOTASH', pair='STONK', viral=7, real=False, sens='Warner Bros. trademark.',
  story="Sylvester is the Looney Tunes tuxedo cat forever chasing Tweety ('Sufferin' succotash!'), debuting in 1945; his cartoons won three Academy Awards. Boomerang celebrated his birthday.",
  look="Black-and-white tuxedo cartoon cat, red nose, white muzzle and chest, lisping grin.")
c('nermal', catName='Nermal', category='tvmovie', owner='Garfield (Paramount / Jim Davis)', keys=['Nermal'], wiki=['List of Garfield characters'],
  name='Nermal the Cutest Kitten', ticker='NERMAL', pair='STONK', viral=5, real=False, sens='Paramount-owned Garfield trademark.',
  story="Nermal is 'the world's cutest kitten' in Jim Davis's Garfield comic (since 1979), who Garfield keeps trying to mail to Abu Dhabi. The official Garfield account: 'Nermal is the cutest kitten ever.'",
  look="Small grey cartoon kitten with long eyelashes and big eyes.")
c('petethecat', catName='Pete the Cat', category='tvmovie', owner='Pete the Cat (James Dean / HarperCollins)', keys=['Pete the Cat'], wiki=['Pete the Cat'],
  name='Pete the Groovy Cat', ticker='GROOVYPETE', pair='STONK', viral=5, real=False, sens='Children\'s book trademark.',
  story="Pete the Cat is the cool blue cat of James Dean's picture books (from 2008), famous for 'I Love My White Shoes'; now an Amazon series.",
  look="Blue cartoon cat, yellow eyes, often in white or red shoes.")
c('mistoffelees', catName='Mr. Mistoffelees', category='tvmovie', owner='CATS (T.S. Eliot / Andrew Lloyd Webber)', keys=['Mistoffelees'], wiki=['Mr. Mistoffelees'],
  name='Magical Mr Mistoffelees', ticker='MISTO', pair='STONK', viral=5, real=False, sens='Eliot poem public domain in some regions; musical is Really Useful Group trademark.',
  story="Mr. Mistoffelees is the 'original conjuring cat' from T.S. Eliot's Old Possum's Book of Practical Cats (1939) and Andrew Lloyd Webber's CATS; the official CATS account introduced him.",
  look="Black cat with white chest and sparkling black coat, white muzzle; slim, dancer-like.")
c('macavity', catName='Macavity', category='tvmovie', owner="T.S. Eliot's Old Possum's Book / CATS", keys=['Macavity'], wiki=['Macavity'],
  name='Macavity the Mystery Cat', ticker='MACAVITY', pair='STONK', viral=4, real=False, sens='Existing MACAVITY coin (~$44k) — check before adopting.',
  story="Macavity is Eliot's 'Mystery Cat', the Napoleon of Crime who is never there when a crime is found, a villain in CATS.", look="Tall, thin ginger cat with sunken eyes and a domed head (per Eliot).")
c('sassy', catName='Sassy', category='tvmovie', owner='Homeward Bound (Disney)', keys=['Sassy cat','Sassy Homeward'], wiki=['Homeward Bound: The Incredible Journey'],
  name='Sassy of Homeward Bound', ticker='SASSYHB', pair='STONK', viral=5, real=False, sens='Disney character; real Himalayan cat actors.',
  story="Sassy is the Himalayan cat who treks across the Sierra Nevada with two dogs, Shadow and Chance, in Disney's Homeward Bound (1993), voiced by Sally Field.",
  look="Himalayan: long cream coat, seal points on face, ears and tail; flat face; blue eyes.")
c('pussinboots', catName='Puss in Boots', category='tvmovie', owner='Shrek / Puss in Boots (DreamWorks / Comcast)', keys=['Puss in Boots'], wiki=['Puss in Boots (Shrek)'],
  name='Puss the Last Wish', ticker='PUSSBOOTS', pair='STONK', viral=6, real=False, sens='DreamWorks trademark; folklore character public domain.', story='', look='')
c('luna', catName='Luna', category='tvmovie', owner='Sailor Moon (Naoko Takeuchi / Toei)', keys=['Luna Sailor Moon','Luna cat'], wiki=['Luna (Sailor Moon)'],
  name='Luna of the Moon Kingdom', ticker='LUNAMOON', pair='STONK', viral=7, real=False, sens='Toei/Kodansha trademark.',
  story="Luna is Usagi's black guardian cat in Sailor Moon, an advisor from the Moon Kingdom marked with a crescent moon on her forehead.",
  look="Black cat with a golden crescent-moon mark on her forehead; red-brown eyes.")
c('artemis', catName='Artemis', category='tvmovie', owner='Sailor Moon (Naoko Takeuchi / Toei)', keys=['Artemis cat'], wiki=['Luna (Sailor Moon)'],
  name='Artemis of Sailor Venus', ticker='ARTEMISCAT', pair='STONK', viral=6, real=False, sens='Toei/Kodansha trademark; NASA Artemis program name overlap.',
  story="Artemis is Sailor Venus's white guardian cat in Sailor Moon. In April 2026 an Artemis plush was spotted on board during NASA's Artemis II launch coverage, widely reported (Dexerto, ToonHive).",
  look="White cat with a golden crescent-moon mark on his forehead; blue eyes.")
c('happy', catName='Happy', category='tvmovie', owner='Fairy Tail (Hiro Mashima / Kodansha)', keys=['Happy Fairy Tail'], wiki=['List of Fairy Tail characters'],
  name='Happy Aye Sir', ticker='AYESIR', pair='STONK', viral=5, real=False, sens='Kodansha trademark.',
  story="Happy is Natsu's flying blue Exceed cat in Fairy Tail, famous for 'Aye sir!'.", look="Blue cartoon cat with white belly, green backpack, can sprout white wings.")
c('nyanko', catName='Nyanko-sensei', category='tvmovie', owner="Natsume's Book of Friends (Yuki Midorikawa)", keys=['Nyanko sensei','Madara'], wiki=["Natsume's Book of Friends"],
  name='Nyanko Sensei', ticker='NYANKOSEN', pair='STONK', viral=5, real=False, sens='Hakusensha trademark.',
  story="Nyanko-sensei is the powerful yokai Madara who, sealed in a maneki-neko, lives as Natsume's round bodyguard cat in Natsume's Book of Friends (manga since 2003).",
  look="Round white-and-grey calico-like cartoon cat with red markings on forehead and ears; stubby limbs.")
c('catbus', catName='Catbus', category='tvmovie', owner='My Neighbor Totoro (Studio Ghibli)', keys=['Catbus','Nekobus'], wiki=['Catbus'],
  name='Catbus', ticker='NEKOBUS', pair='STONK', viral=7, real=False, sens='Studio Ghibli trademark (strictly enforced).',
  story="The Catbus (Nekobasu) is the twelve-legged grinning bus-cat of Hayao Miyazaki's My Neighbor Totoro (1988); the Ghibli Museum has a ride-in Catbus.", look="Huge orange-brown tabby bus with twelve legs, glowing yellow eyes as headlights, grin.")
c('chi', catName='Chi', category='tvmovie', owner="Chi's Sweet Home (Konami Kanata / Kodansha)", keys=["Chi Sweet Home","Chi cat"], wiki=["Chi's Sweet Home"],
  name="Chi's Sweet Home", ticker='CHISWEET', pair='STONK', viral=5, real=False, sens='Kodansha trademark.',
  story="Chi is the lost grey-and-white kitten adopted by the Yamada family in Konami Kanata's manga Chi's Sweet Home (2004–15), with several anime adaptations.",
  look="Grey-and-white tabby kitten with dark stripes on back, white belly and paws, big round eyes.")
c('meowth', catName='Meowth', category='tvmovie', owner='Pokémon (Nintendo/Game Freak/Creatures)', keys=['Meowth'], wiki=['Meowth'],
  name='Meowth Thats Right', ticker='MEOWTHR', pair='STONK', viral=8, real=False, sens='Pokémon Company trademark (enforced).', story='', look='')
c('sprigatito', catName='Sprigatito', category='tvmovie', owner='Pokémon (Nintendo/Game Freak/Creatures)', keys=['Sprigatito'], wiki=['Sprigatito'],
  name='Sprigatito', ticker='SPRIGATO', pair='STONK', viral=6, real=False, sens='Pokémon Company trademark (enforced).',
  story="Sprigatito, 'the capricious, attention-seeking Grass Cat Pokémon', was revealed in 2022 as a starter for Pokémon Scarlet and Violet and became an instant fan favourite (Polygon).",
  look="Small green cat-like Pokémon with a leaf-shaped mask marking, pink nose, green eyes.")
c('bigthecat', catName='Big the Cat', category='tvmovie', owner='Sonic the Hedgehog (SEGA)', keys=['Big the Cat'], wiki=['List of Sonic the Hedgehog characters'],
  name='Big the Cat', ticker='BIGFROGGY', pair='STONK', viral=5, real=False, sens='SEGA trademark.',
  story="Big the Cat is the laid-back purple fisherman cat of SEGA's Sonic Adventure (1998), always searching for his frog friend Froggy; SEGA added him to Sonic Racing: CrossWorlds (2025).", look="Large purple cat, cream belly and muzzle, yellow eyes, fishing rod, frog Froggy.")
c('blaze', catName='Blaze the Cat', category='tvmovie', owner='Sonic the Hedgehog (SEGA)', keys=['Blaze the Cat'], wiki=['List of Sonic the Hedgehog characters'],
  name='Blaze the Cat', ticker='BLAZECAT', pair='STONK', viral=5, real=False, sens='SEGA trademark.',
  story="Blaze the Cat, the pyrokinetic princess from another dimension, debuted in SEGA's Sonic Rush (2005); SEGA marked the game's 20th anniversary in 2025.", look="Lavender cat, red jewel on forehead, golden eyes, purple coat with white trim.")
c('palico', catName='Palico (Felyne)', category='tvmovie', owner='Monster Hunter (Capcom)', keys=['Palico','Felyne'], wiki=['Monster Hunter'],
  name='Palico Hunting Buddy', ticker='PALICO', pair='STONK', viral=5, real=False, sens='Capcom trademark; a species/role, not one named cat.',
  story="Palicoes are Felynes—talking cat companions—who fight beside hunters in Capcom's Monster Hunter series; they returned in Monster Hunter Wilds (2025).", look="Small bipedal cat in armor; default white-orange-black calico Felyne with big eyes.")
c('tubbs', catName='Tubbs', category='tvmovie', owner='Neko Atsume (Hit-Point)', keys=['Tubbs','Neko Atsume'], wiki=['Neko Atsume'],
  name='Tubbs of Neko Atsume', ticker='TUBBS', pair='STONK', viral=4, real=False, sens='Hit-Point trademark; X proof names the game, not Tubbs.',
  story="Tubbs is the famously fat rare cat in Hit-Point's Neko Atsume (2014), who empties your food bowl; the game became a global hit.", look="Very round white cat with cream markings.")
c('stray', catName='The Stray cat', category='tvmovie', owner='Stray (BlueTwelve Studio / Annapurna Interactive)', keys=['Stray cat game','Stray game'], wiki=['Stray (video game)'],
  name='Stray Neon Cat', ticker='STRAYB12', pair='STONK', viral=6, real=False, sens='Protagonist has no official name; modelled on the developers\' real cats Murtaugh and Jun.',
  story="Stray (2022) by BlueTwelve Studio, published by Annapurna Interactive, puts players in control of an orange tabby lost in a neon cyber-city of robots, helped by drone B-12.",
  look="Orange ginger tabby with white chest, short coat, amber eyes; harness with small drone B-12.")
c('caitsith', catName='Cait Sith', category='tvmovie', owner='Final Fantasy VII (Square Enix)', keys=['Cait Sith'], wiki=['Cait Sith (Final Fantasy)'],
  name='Cait Sith', ticker='CAITSITH', pair='STONK', viral=5, real=False, sens='Square Enix trademark.',
  story="Cait Sith is the wisecracking fortune-telling robot cat of Final Fantasy VII who rides a giant moogle; he returned in FF7 Rebirth (2024).", look="Black cat with white muzzle, red cape, gold crown, megaphone, riding a white moogle.")
c('chococat', catName='Chococat', category='tvmovie', owner='Sanrio', keys=['Chococat'], wiki=['Chococat'],
  name='Chococat', ticker='CHOCOCAT', pair='STONK', viral=5, real=False, sens='Sanrio trademark (strictly enforced).',
  story="Chococat is Sanrio's intuitive black cat with chocolate-chip eyes, created in 1996; Sanrio celebrated his 30th anniversary in 2026.", look="Black cartoon cat with big dark eyes, antenna-like whiskers, blue scarf.")
c('snagglepuss', catName='Snagglepuss', category='tvmovie', owner='Hanna-Barbera (Warner Bros.)', keys=['Snagglepuss'], wiki=['Snagglepuss'],
  name='Snagglepuss', ticker='MURGATROYD', pair='STONK', viral=3, real=False, sens='WBD trademark; a pink mountain lion.',
  story="Snagglepuss is Hanna-Barbera's theatrical pink mountain lion ('Heavens to Murgatroyd!'), debuting in 1959.", look="Pink mountain lion, collar and cuffs, theatrical pose.")

# ---------------- crypto ----------------
c('cryptokitties-genesis', catName='Genesis (CryptoKitty #1)', category='crypto', owner='CryptoKitties (Dapper Labs)', keys=['Genesis kitty','CryptoKitties'], wiki=['CryptoKitties'],
  name='Genesis the First CryptoKitty', ticker='GENKITTY', pair='STONK', viral=6, real=False,
  sens='Dapper Labs trademark; NFT character.',
  story="Genesis is CryptoKitty #1 of Dapper Labs' 2017 Ethereum game, which congested the network. Genesis sold for 246.9 ETH (~$117k) in December 2017; the official account even posted about Genesis 'owning' other kitties.",
  look="Chubby cartoon CryptoKitty: black-and-white body pattern, big green-gold eyes, smug smile (per NFT art).")
c('masya', catName='Masya', category='crypto', owner='Buterin family', keys=['Masya'], wiki=[], name='', ticker='', pair='', viral=0, real=True, sens='', story='', look='')
c('toshi', catName='Toshi', category='crypto', owner='Brian Armstrong', keys=['Toshi'], wiki=[], name='', ticker='', pair='', viral=0, real=True, sens='', story='', look='')
c('nyan', catName='Nyan Cat', category='crypto', owner='Chris Torres', keys=['Nyan Cat'], wiki=[], name='', ticker='', pair='', viral=0, real=False, sens='', story='', look='')

# ---------------- viral / historic ----------------
c('bob', catName='Bob', category='viral', owner='James Bowen', keys=['Street Cat Bob','Streetcat Bob'], wiki=['Bob (cat)'],
  name='Street Cat Bob', ticker='STREETBOB', pair='STONK', viral=8, real=True, sens='Deceased (2020); owner James Bowen died in 2025—sensitive.',
  story="Bob was a ginger stray who adopted busker James Bowen in London in 2007; their story became the bestseller A Street Cat Named Bob and two films in which Bob played himself. He died in 2020; a bronze statue stands in Islington.",
  look="Ginger (orange) tabby with white-tipped muzzle hints, often wearing a scarf and perched on shoulders; green eyes.")
c('stubbs', catName='Stubbs', category='viral', owner='Talkeetna, Alaska (Nagley\'s store)', keys=['Mayor Stubbs','Stubbs cat'], wiki=['Stubbs (cat)'],
  name='Mayor Stubbs', ticker='MAYORSTUB', pair='STONK', viral=6, real=True, sens='Deceased (2017).',
  story="Stubbs, a tailless orange-tabby Manx mix, was the honorary mayor of Talkeetna, Alaska, from 1997 until his death at 20 in 2017, as CNN reported.",
  look="Orange tabby with short stub tail (Manx), white chest; amber eyes.")
c('minerva', catName='Minerva', category='viral', owner='Somerville, MA community', keys=['Minerva cat','Mayor Minerva'], wiki=[],
  name='Mayor Minerva', ticker='MINERVA', pair='STONK', viral=4, real=True, sens='Living cat of a private owner; keep owner private.',
  story="Minerva won the 2025 Somerville (Massachusetts) Community Path 'cat mayor' election after a fierce contest reported by 7News Boston; Larry the Cat (@Number10cat) weighed in on the race.",
  look="Verify from election photos before art.")
c('gli', catName='Gli', category='viral', owner='Hagia Sophia, Istanbul', keys=['Gli cat','Hagia Sophia cat'], wiki=['Gli (cat)'],
  name='Gli of Hagia Sophia', ticker='GLI', pair='STONK', viral=7, real=True, sens='Deceased (2020); religious site—treat respectfully.',
  story="Gli (2004–2020) was the tabby born at Hagia Sophia who lived there for 16 years; Barack Obama petted her on a 2009 visit. Reuters covered her fame; she died in November 2020 and was buried on the grounds.",
  look="Tabby-and-white Turkish shorthair with striking green eyes set slightly crossed; white chest and paws.")
c('tombili', catName='Tombili', category='viral', owner='Kadıköy, Istanbul', keys=['Tombili'], wiki=['Tombili'],
  name='Tombili of Istanbul', ticker='TOMBILI', pair='STONK', viral=7, real=True, sens='Deceased (2016) street cat.',
  story="Tombili was a chubby Istanbul street cat famous for lounging against a step with one paw draped; after her 2016 death a bronze statue of her pose was placed in Kadıköy, stolen and recovered.",
  look="Chubby white-and-grey tabby with grey tabby patches on head and back; lounging pose.")
c('simon', catName='Simon', category='viral', owner='HMS Amethyst (Royal Navy)', keys=['Simon ship cat','Able Seacat Simon'], wiki=['Simon (cat)'],
  name='Able Seacat Simon', ticker='SEACAT', pair='STONK', viral=5, real=True, sens='Historic (d. 1949); war context.',
  story="Simon was ship's cat of HMS Amethyst; wounded during the 1949 Yangtze Incident, he kept killing rats and raising morale and became the only cat awarded the PDSA Dickin Medal.",
  look="Black-and-white tuxedo cat with white face blaze and chest; scarred whiskers.")
c('unsinkablesam', catName='Unsinkable Sam', category='viral', owner='Kriegsmarine / Royal Navy (WWII legend)', keys=['Unsinkable Sam'], wiki=['Unsinkable Sam'],
  name='Unsinkable Sam', ticker='UNSINKSAM', pair='STONK', viral=5, real=True, sens='Historic, partly apocryphal WWII legend; Nazi-navy context.',
  story="Unsinkable Sam (Oscar) is the WWII ship's cat said to have survived the sinkings of Bismarck, HMS Cossack and HMS Ark Royal in 1941; World of Warships featured him.",
  look="Black-and-white cat (tuxedo) as in Georgina Shaw-Baker's pastel portrait.")
c('faith', catName='Faith', category='viral', owner="St Augustine's Church, Watling Street, London", keys=['Faith church cat'], wiki=['Faith (cat)'],
  name='Faith the Church Cat', ticker='FAITHCAT', pair='STONK', viral=4, real=True, sens='Historic (d. 1948); church setting.',
  story="Faith was the church cat of St Augustine's, London, who moved her kitten Panda to the basement days before the church was bombed in the September 1940 Blitz; both survived and she was honoured with a PDSA silver medal.",
  look="Grey-and-white tabby with white chest; kitten Panda black-and-white.")
c('oscar', catName='Oscar', category='viral', owner='Steere House Nursing & Rehabilitation Center', keys=['Oscar hospice cat','Oscar therapy cat'], wiki=['Oscar (therapy cat)'],
  name='Oscar the Therapy Cat', ticker='OSCARRI', pair='STONK', viral=5, real=True, sens='Deceased (2022); story involves predicting deaths of patients—handle sensitively.',
  story="Oscar lived at Steere House nursing home in Providence, RI, and reportedly curled up with more than 100 patients in their final hours, as described by Dr. David Dosa in the NEJM (2007). He died in 2022.",
  look="Grey-brown tabby-and-white cat with white chest and paws.")
c('eriktheread', catName='Erik the Red', category='viral', owner='CSS Acadia / Maritime Museum of the Atlantic', keys=['Erik the Red cat'], wiki=[],
  name='Erik the Red Ship Cat', ticker='ERIKRED', pair='STONK', viral=3, real=True, sens='Historic ship\'s cat.',
  story="Erik the Red was the rodent patrol officer aboard the hydrographic ship CSS Acadia for over 15 years; in 2026 a statue honouring him was unveiled on the Halifax waterfront (CTV News).",
  look="Ginger/red tabby (per name and statue); verify with museum photos.")
c('stepan', catName='Stepan', category='viral', owner='Anna (Kharkiv)', keys=['Stepan cat','Stepan'], wiki=['Stepan (cat)'],
  name='Stepan of Kharkiv', ticker='STEPAN', pair='STONK', viral=7, real=True, sens='Living owner is a private person; war context—keep apolitical and respectful.',
  story="Stepan is the Kharkiv cat whose deadpan poses with wine glasses made him an Instagram star; after Russia's 2022 invasion he fled with his owner and raised funds for Ukrainian animals, and won a World Influencers and Bloggers Award.",
  look="Brown/grey tabby British-type cat with round face, white chest; yellow-green eyes; seated upright.")
c('didga', catName='Didga', category='viral', owner='Robert Dollwet (CATMANTOO)', keys=['Didga'], wiki=[],
  name='Didga the Skater Cat', ticker='DIDGA', pair='GPRO', viral=6, real=True, sens='Living cat of a private trainer; GoPro trademark if pairing with GPRO.',
  story="Didga, an Australian rescue trained by Robert Dollwet, holds the Guinness World Record for most tricks by a cat in one minute (24); GoPro featured 'Didga the skateboarding cat' in 2016.",
  look="Tortoiseshell (black with ginger mottling) short-haired cat; amber eyes; on a skateboard.")
c('colonelmeow', catName='Colonel Meow', category='viral', owner='Anne Marie Avey', keys=['Colonel Meow'], wiki=['Colonel Meow'],
  name='Colonel Meow', ticker='COLMEOW2', pair='STONK', viral=6, real=True, sens='Deceased (2014); existing tiny COLMEOW coin.',
  story="Colonel Meow, a Himalayan-Persian mix from Los Angeles, entered Guinness World Records in 2014 for the longest cat fur (about 23 cm) and was known for his scowl; he died in January 2014.",
  look="Himalayan-Persian: very long fluffy grey-brown/silver coat, flat face, scowling expression, copper eyes.")
c('hamilton', catName='Hamilton the Hipster Cat', category='viral', owner='Jeremy Ruiz', keys=['Hamilton hipster cat','Hamilton cat'], wiki=[],
  name='Hamilton the Hipster Cat', ticker='MUSTACHE', pair='STONK', viral=5, real=True, sens='Living cat of a private owner.',
  story="Hamilton is a San Francisco Bay Area rescue cat with a natural white mustache marking, an internet star since 2013 (@TheMustacheCat).",
  look="Grey/blue-grey coat with a bold white handlebar-mustache marking under the nose, white chin; yellow eyes.")
c('venus', catName='Venus', category='viral', owner='Christina Parker (owner)', keys=['Venus two face','Venus cat'], wiki=[],
  name='Venus the Two Face Cat', ticker='VENUS2F', pair='STONK', viral=6, real=True, sens='Living cat; owner warns of impersonator accounts and a $Venus coin exists.',
  story="Venus is a North Carolina tortoiseshell 'chimera' cat whose face is split: one half black with a green eye, the other orange tabby with a blue eye. The Dodo covered her in 2014; in December 2024 her account confirmed she was alive at 15.",
  look="Face split vertically: left half solid black, right half orange tabby; one green eye, one blue eye; black body with orange patches.")
c('lilbub', catName='Lil BUB', category='viral', owner='Mike Bridavsky', keys=['Lil Bub'], wiki=['Lil Bub'],
  name='Lil BUB Space Cat', ticker='LILBUB', pair='STONK', viral=8, real=True, sens='Deceased (2019).',
  story="Lil BUB (2011–2019) was the 'magical space cat' with dwarfism, extra toes and a permanently protruding tongue, cared for by Mike Bridavsky; she raised over $700,000 for pets and starred in Lil Bub & Friendz (2013).",
  look="Small grey-brown tabby with white chest, tiny face, big green eyes, tongue always sticking out, short legs.")
c('maru', catName='Maru', category='viral', owner='mugumogu (Japan)', keys=['Maru cat'], wiki=['Maru (cat)'],
  name='Maru the Box Cat', ticker='MARUBOX', pair='STONK', viral=8, real=True, sens='Deceased (Sept 2025).',
  story="Maru, a Scottish Fold from Japan, rose to fame in 2008 diving into cardboard boxes; Guinness recognised him in 2016 as YouTube's most-viewed animal. He died in September 2025 aged 18.",
  look="Scottish Straight (upright ears): cream-white and grey-brown tabby, chubby round body; golden eyes; inside a cardboard box.")
c('nala', catName='Nala', category='viral', owner='Varisiri Mathachittiphan', keys=['Nala Cat'], wiki=['Nala Cat'],
  name='Nala Cat', ticker='NALACAT', pair='STONK', viral=7, real=True, sens='Living cat of a private owner; heavily merchandised brand; small Nala coins exist.',
  story="Nala, a Siamese-tabby shelter rescue from California, holds the Guinness World Record for the most-followed cat on Instagram (4+ million).",
  look="Siamese-tabby mix: white/cream coat with grey tabby points on ears and tail, brilliant blue eyes, often in a small hat or bow.")
c('jorts', catName='Jorts', category='viral', owner='Jean (anonymous office worker)', keys=['Jorts'], wiki=['Jorts'],
  name='Jorts the Orange Cat', ticker='BUTTERED', pair='STONK', viral=7, real=True, sens='Owners are anonymous; the account is pro-union—keep apolitical.',
  story="Jorts is the orange workplace cat from a viral 2021 Reddit AITA post in which a coworker wanted to 'help' him by greasing him with butter; he and tortie Jean became internet icons (@JortsTheCat).",
  look="Big orange (ginger) tabby with white chest, sweet dim expression; amber eyes.")
c('atchoum', catName='Atchoum', category='viral', owner='Nathalie Dubois (Quebec)', keys=['Atchoum'], wiki=[],
  name='Atchoum the Hairy Cat', ticker='ATCHOUM', pair='STONK', viral=5, real=True, sens='Living cat of a private owner.',
  story="Atchoum is a Quebec Persian cat with hypertrichosis whose wild beard and piercing stare made him famous online ('I'm hairy not scary').",
  look="Persian with extremely shaggy grey-brown and white face fur forming a beard; intense round yellow-copper eyes.")
c('coleandmarmalade', catName='Cole & Marmalade', category='viral', owner='Chris Poole ("Cat Man Chris")', keys=['Cole and Marmalade'], wiki=[],
  name='Cole and Marmalade', ticker='COLEMARM', pair='STONK', viral=5, real=True, sens='Living cats; past ownership dispute over the channel.',
  story="Cole (black) and Marmalade (ginger) are the rescue cats of 'Cat Man Chris' Poole whose YouTube channel has millions of subscribers; the channel promotes rescue and indoor-cat care.",
  look="Two cats: Cole solid black with yellow eyes; Marmalade orange tabby with white chest.")
c('pusheen', catName='Pusheen', category='viral', owner='Pusheen Corp (Claire Belton & Andrew Duff)', keys=['Pusheen'], wiki=['Pusheen'],
  name='Pusheen', ticker='PUSHEEN', pair='STONK', viral=8, real=False, sens='Pusheen Corp trademark; an existing PUSHEEN coin (~$35k).',
  story="Pusheen is the chubby grey tabby cartoon cat created by Claire Belton and Andrew Duff in 2010, based on Belton's cat; famous for GIFs and stickers.", look="Chubby grey cartoon tabby with darker stripes on head and back, tiny paws.")
c('yamato-kuroneko', catName='Kuroneko (Yamato)', category='company', owner='Yamato Transport (Yamato Holdings, TSE 9064)', keys=['Kuroneko Yamato','Kuroneko'], wiki=['Yamato Transport'],
  name='Kuroneko Yamato', ticker='KURONEKO', pair='STONK', viral=5, real=False, sens='Yamato Holdings trademark (black-cat logo).',
  story="Kuroneko is Yamato Transport's black mother cat carrying her kitten, a logo since 1957 promising careful delivery; inspired partly by a designer's daughter's drawing of their black cat Kuro, refreshed in 2021.",
  look="Black mother cat carrying a black kitten by the scruff; yellow eyes; logo-style silhouette.")
c('chester', catName='Chester Cheetah', category='company', owner='Cheetos (PepsiCo, NASDAQ: PEP)', keys=['Chester Cheetah'], wiki=['Chester Cheetah'],
  name='Chester the Cheesy Cheetah', ticker='CHEETLE', pair='STONK', viral=6, real=False, sens='PepsiCo trademark; a cheetah.',
  story="Chester Cheetah has been Cheetos' sunglasses-wearing mascot since 1986, still posting on X about 'Cheetle' (the orange dust).", look="Orange spotted cartoon cheetah, sunglasses, sneakers, cool grin.")
c('tony', catName='Tony the Tiger', category='company', owner="Frosted Flakes (Kellogg / WK Kellogg Co)", keys=['Tony the Tiger'], wiki=['Tony the Tiger'],
  name='Tony the Grreat Tiger', ticker='GRREAT', pair='STONK', viral=6, real=False, sens='Kellogg trademark; a tiger.',
  story="Tony the Tiger has been the Frosted Flakes mascot since 1952 ('They're Gr-r-reat!').", look="Orange cartoon tiger with black stripes, red bandana, blue nose.")
c('morris', catName='Morris the Cat', category='company', owner='9Lives (Post Holdings)', keys=['Morris the Cat'], wiki=['Morris the Cat'],
  name='Morris the Finicky Cat', ticker='FINICKY', pair='STONK', viral=5, real=True, sens='9Lives trademark; played by several real shelter cats.',
  story="Morris, an orange tabby discovered at a Chicago-area shelter, became 9Lives' 'finicky' spokescat in 1969; successors kept the role and 'ran for president' in 1988 and 1992.",
  look="Large orange tabby with white chest, dignified pose; golden eyes.")
c('octocat', catName='Mona the Octocat', category='company', owner='GitHub (Microsoft, NASDAQ: MSFT)', keys=['Octocat','Mona Octocat'], wiki=['GitHub'],
  name='Mona the Octocat', ticker='OCTOMONA', pair='MSFTX', viral=6, real=False, sens='GitHub/Microsoft trademark; a cat-octopus hybrid.',
  story="Mona the Octocat is GitHub's cat-octopus mascot, drawn by Simon Oxley and adopted in 2008; GitHub explained her name came from the 7-year-old daughter of a GitHub developer.", look="Black cartoon cat head with five octopus tentacles, big eyes, pink ears.")
c('scratchcat', catName='Scratch Cat', category='company', owner='Scratch (MIT Media Lab / Scratch Foundation)', keys=['Scratch Cat'], wiki=['Scratch (programming language)'],
  name='Scratch Cat', ticker='SCRATCHC', pair='STONK', viral=5, real=False, sens='Scratch Foundation trademark; audience is children—be careful.',
  story="Scratch Cat is the orange default sprite of MIT's Scratch programming language (2007), used by tens of millions of kids learning to code.", look="Orange cartoon cat standing upright, white belly, simple vector outline.")
c('talkingtom', catName='Talking Tom', category='company', owner='Outfit7', keys=['Talking Tom'], wiki=['Talking Tom & Friends'],
  name='Talking Tom', ticker='TALKTOM', pair='STONK', viral=6, real=False, sens='Outfit7 trademark; children\'s app.',
  story="Talking Tom is Outfit7's grey tabby that repeats what you say, launched in 2010 and grown into one of the most downloaded app franchises.", look="Grey tabby cartoon cat, green eyes, big grin.")
c('cryptokitties', catName='', category='', owner='', keys=[], wiki=[], name='', ticker='', pair='', viral=0, real=False, sens='', story='', look='')
del C['cryptokitties']
