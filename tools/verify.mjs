import assert from 'node:assert/strict';
import { chromium } from '../.dev/node_modules/playwright-core/index.mjs';
const launch = {executablePath:'/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',headless:true,args:['--no-sandbox'],...(process.env.MAKEFUN_BROWSER_PROXY ? {proxy:{server:process.env.MAKEFUN_BROWSER_PROXY,bypass:'127.0.0.1,localhost'}} : {})};
const browser = await chromium.launch(launch);
const page = await browser.newPage({viewport:{width:1280,height:800},ignoreHTTPSErrors:true});
page.setDefaultTimeout(30000);
const errors=[], requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(request.url().startsWith('https://make.fun/api'))requests.push({url:request.url(),method:request.method(),headers:request.headers()});});
async function ready(route){await page.waitForFunction(route=>window.__shotReady&&window.__shotRoute===route,route);assert.equal(await page.locator('.error:visible').count(),0,await page.locator('.error:visible').allTextContents());}
async function visit(route){await page.evaluate(route=>{location.hash=route;},route);await ready(route);}
try {
 await page.goto('http://127.0.0.1:8080/#/');await ready('#/');
 const shell = await page.locator('.topbar').evaluate(node=>{node.dataset.retained='yes';return true;});
 assert.ok(shell);assert.equal(await page.locator('.bounty-card:visible').count(),8);
 await page.getByRole('searchbox',{name:'Search bounties'}).fill('frontend');assert.equal(await page.locator('.bounty-card:visible').count(),1);
 await page.getByRole('searchbox',{name:'Search bounties'}).fill('');
 await page.getByRole('button',{name:'Games',exact:true}).click();assert.ok((await page.locator('.bounty-card .category:visible').allTextContents()).every(text=>text.includes('Games')));
 assert.equal(await page.getByRole('button',{name:'Games',exact:true}).evaluate(node=>node===document.activeElement),true);
 await page.getByRole('button',{name:'All',exact:true}).click();
 await page.getByRole('combobox',{name:'Filter by entry status'}).selectOption('ended');assert.ok((await page.locator('.bounty-card .badge:visible').allTextContents()).every(text=>text==='Entries closed'));
 await page.getByRole('combobox',{name:'Filter by entry status'}).selectOption('upcoming');assert.ok((await page.locator('.bounty-card .badge:visible').allTextContents()).every(text=>text==='Opening soon'));
 await page.getByRole('combobox',{name:'Filter by entry status'}).selectOption('live');
 await page.getByRole('button',{name:'Next page'}).click();assert.ok(await page.locator('.bounty-card:visible').count()<8);await page.getByRole('button',{name:'Previous page'}).click();
 assert.equal(requests.filter(r=>r.url.includes('/competitions?')).length,1);
 console.log('PASS board: live status, search, categories, keyboard focus, pagination; one API request');
 await visit('#/bounty/makefun-frontend-01');
 assert.equal(await page.locator('.entry-row:visible').count(),6);assert.equal(await page.locator('.rewards tbody tr:visible').count(),3);
 await page.locator('.rewards summary').click();assert.equal(await page.locator('.rewards tbody tr:visible').count(),20);
 assert.ok(await page.locator('.prose details').count()>10);assert.ok((await page.locator('.bounty-dates').innerText()).includes('UTC'));
 await page.getByRole('button',{name:'Load older entries'}).click();await page.waitForFunction(()=>document.querySelectorAll('.entry-row').length===12);
 console.log('PASS bounty: live pot, full payout table, dates, rules, paged entries');
 await visit('#/bounty/makefun-frontend-01/leaderboard');
 assert.equal(await page.locator('.leaderboard-table tbody tr').count(),10);assert.match(await page.locator('.metric-rate').first().innerText(),/\d+\.\d{4}%/);
 assert.equal(await page.locator('.leaderboard-table th').count(),7);
 await page.getByRole('button',{name:'Next page'}).click();await page.waitForFunction(()=>document.querySelector('.leaderboard-table tbody td')?.textContent==='11');
 assert.equal(await page.locator('.leaderboard-table tbody tr').count(),10);
 await page.getByRole('searchbox',{name:'Search leaderboard'}).fill('niskalaxyz');await page.waitForFunction(()=>document.querySelectorAll('.leaderboard-table tbody tr').length===1);
 await visit('#/u/eager-beacon-38');
 assert.equal(await page.locator('.profile-table tbody tr').count(),10);assert.ok((await page.locator('.wallet').innerText()).length>30);
 assert.match(await page.getByRole('link',{name:'View on explorer'}).getAttribute('href'),/^https:\/\//);
 await page.getByRole('button',{name:'Copy address'}).click();await page.getByRole('button',{name:'Address copied'}).waitFor();
 await page.getByRole('button',{name:'Next page'}).click();assert.ok(await page.locator('.profile-table tbody tr').count()<10);
 console.log('PASS leaderboard and profile: dynamic metrics, pagination, real public wallet, copy action');
 await visit('#/u/niskalaxyz');
 await page.waitForFunction(()=>document.querySelector('.profile-heading img')?.naturalWidth>0);
 console.log('PASS public avatar: live image loads with anonymous CORS');
 const edge = await page.evaluate(async()=>{const {metricValue}=await import('./detail.js');return [metricValue({key:'judge'},{values:{judge:0}}),metricValue({key:'judge'},{values:{judge:500}}),metricValue({key:'elo',title:'Elo'},{values:{elo:1543.2}})];});
 assert.deepEqual(edge,['0.0000%','0.0500%','1,543.2 Elo']);
 const previousRequests=requests.length;await visit('#/');assert.equal(requests.length,previousRequests);assert.equal(await page.locator('.topbar').getAttribute('data-retained'),'yes');
 await page.evaluate(async()=>{const {cachedGet}=await import('./main.js');await cachedGet('/competitions?status=open&activity=times&limit=100',true);});
 assert.ok(requests.some(r=>r.headers['if-none-match']));
 assert.ok(requests.every(r=>r.method==='GET'));
 console.log('PASS cache: retained shell, zero-request return, ETag conditional revalidation, GET only; metric edge cases');
 for(const route of ['#/','#/bounty/makefun-frontend-01','#/bounty/makefun-frontend-01/leaderboard','#/u/eager-beacon-38']){
  await page.setViewportSize({width:390,height:844});await visit(route);
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(width.scroll<=width.viewport,`${route}: ${JSON.stringify(width)}`);
  assert.equal(await page.locator('h1:visible').count(),1);
 }
 console.log('PASS all four surfaces on 390px phone: live data, no page overflow');
 assert.deepEqual(errors,[]);
} finally {await browser.close();}

// recorded rewrite
