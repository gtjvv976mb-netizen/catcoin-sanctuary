const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/');await p.waitForTimeout(20000);await p.screenshot({path:process.argv[2]});await b.close();})();
