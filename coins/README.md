# coins/

The metadata of the coins the sanctuary's automatic launcher launches (`scripts/launch.mjs`), one
JSON file per trending X post, named by the post's id (never by the mint, so a coin's address is not
public before its launch is sent): `coins/<postId>.json`, served by the site at
`https://catcoinsanctuary.com/coins/<postId>.json`, the uri the coin carries on chain.

Each file is pump.fun's metadata shape, the same whichever launchpad the coin goes to (pump.fun in
SOL, StonkFun in a stock pair, or pump.fun in a listed coin; StonkFun reads the same fields): `name`,
`symbol`, `description` (the cat's lore line, "From the Catcoin Sanctuary."), `image` (the post's own
picture, hotlinked from pbs.twimg.com, never copied here), `showName`, `createdOn`, `website` (the
cat's card) and `twitter`. So a launch that falls back to pump.fun in SOL before it is sent keeps the
file its uri already serves. The launcher writes a file in its prepare phase and never sends the
launch until the site serves it exactly as committed.

Never delete or rename a file here once its coin is launched: the coin's uri points to it for good.
This note is not published (the Pages workflow leaves out Markdown files).
