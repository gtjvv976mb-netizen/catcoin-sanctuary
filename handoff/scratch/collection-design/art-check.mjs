import { createRequire } from "node:module";
const require = createRequire("/home/user/Cat-Intelligence-Agency/bots/package.json");
const { loadImage, createCanvas } = require("@napi-rs/canvas");
const K = ["black","calico","ginger","greytabby","siamese","sphynx","tuxedo","white"];
for (const k of K) {
  const img = await loadImage(`/home/user/Cat-Intelligence-Agency/bots/cashcat/art/${k}.png`);
  const c = createCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let maxA = 0, minY = 1e9, maxY = 0, minX=1e9, maxX=0, partial = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const a = d[(y*img.width+x)*4+3]; if (a > maxA) maxA = a; if (a>0 && a<128) partial++; if (a >= 128) { if (y<minY)minY=y; if(y>maxY)maxY=y; if(x<minX)minX=x; if(x>maxX)maxX=x; } }
  console.log(k, img.width, img.height, "maxA", maxA, "bbox(a>=128)", minX, minY, maxX, maxY, "partial", partial);
}
