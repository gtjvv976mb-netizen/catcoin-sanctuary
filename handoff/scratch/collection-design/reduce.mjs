import { createRequire } from "node:module";
const require = createRequire("/home/user/Cat-Intelligence-Agency/bots/package.json");
const { loadImage, createCanvas } = require("@napi-rs/canvas");
import fs from "node:fs";
// naive: nearest sample at 14.6 px cells, alpha>=128, show ginger at 64 cells tall and upscale 4x
const img = await loadImage("/home/user/Cat-Intelligence-Agency/bots/cashcat/art/ginger.png");
const c = createCanvas(1024,1024); const g=c.getContext("2d"); g.drawImage(img,0,0);
const d=g.getImageData(0,0,1024,1024).data;
const cell=14.6, x0=200, y0=60, W=Math.ceil((830-200)/cell), H=Math.ceil((970-60)/cell);
const o=createCanvas(W*4,H*4); const og=o.getContext("2d");
for(let j=0;j<H;j++)for(let i=0;i<W;i++){const x=Math.round(x0+(i+0.5)*cell), y=Math.round(y0+(j+0.5)*cell); if(x>1023||y>1023)continue; const p=(y*1024+x)*4; if(d[p+3]<128)continue; og.fillStyle=`rgb(${d[p]},${d[p+1]},${d[p+2]})`; og.fillRect(i*4,j*4,4,4);}
fs.writeFileSync("ginger-reduced.png", o.toBuffer("image/png")); console.log(W,H);
