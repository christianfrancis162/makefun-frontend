import {readFile,stat,unlink} from 'node:fs/promises';
import {chromium} from '../.dev/node_modules/playwright-core/index.mjs';
const shots=JSON.parse(await readFile(new URL('../shots.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:process.env.MAKEFUN_CHROMIUM || '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',headless:true,args:['--no-sandbox'],...(process.env.MAKEFUN_BROWSER_PROXY ? {proxy:{server:process.env.MAKEFUN_BROWSER_PROXY,bypass:'localhost,127.0.0.1'}} : {})});
try {
 for(const shot of shots){
  const page=await browser.newPage({viewport:shot.viewport,ignoreHTTPSErrors:true});
  page.setDefaultTimeout(30000);
  await page.goto((process.env.MAKEFUN_PREVIEW_URL || 'http://127.0.0.1:8080/')+shot.path);
  await page.waitForFunction(route=>window.__shotReady&&window.__shotRoute===route,shot.path);
  if(await page.locator('.error').count())throw new Error(await page.locator('.error').innerText());
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.race([Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))),new Promise(resolve=>setTimeout(resolve,7000))]);});
  const destination=new URL('../screenshots/'+shot.file,import.meta.url);
  await page.screenshot({path:destination.pathname,type:'jpeg',quality:90,fullPage:false});
  const info=await stat(destination);
  if(info.size>262144)throw new Error(shot.file+' exceeds the screenshot cap.');
  console.log(shot.file,shot.path,info.size+' bytes',await page.locator('h1').innerText());
  await page.close();
 }
 const old=new URL('../screenshots/3-bounty.jpg',import.meta.url);
 await unlink(old).catch(error=>{if(error.code!=='ENOENT')throw error;});
} finally {await browser.close();}

// recorded rewrite
// recorded rewrite 2
// recorded rewrite 3
