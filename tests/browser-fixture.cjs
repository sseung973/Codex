const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
async function load(page,{beforeGame,fontStatus=200,artStatus=200,keepTitle=false}={}){await page.route('https://shuttle-assets.test/assets/**',async r=>{const file=path.basename(new URL(r.request().url()).pathname);await r.fulfill({status:file.endsWith('.ttf')?fontStatus:artStatus,headers:{'access-control-allow-origin':'*'},contentType:file.endsWith('.ttf')?'font/ttf':file.endsWith('.webp')?'image/webp':'text/plain',body:fs.readFileSync(path.join(root,'assets',file))});});let html=fs.readFileSync(root+'/index.html','utf8').replaceAll('src="assets/','src="https://shuttle-assets.test/assets/');const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1].split('?')[0]);html=html.replace(/<link rel="stylesheet" href="([^\"]+)">/g,(_,href)=>'<style>'+fs.readFileSync(path.join(root,href.split('?')[0]),'utf8').replaceAll("url('assets/","url('https://shuttle-assets.test/assets/")+'</style>').replace(/<script src="[^"]+"><\/script>/g,'');await page.setContent(html);for(const file of scripts){if(file==='game.js'&&beforeGame)await beforeGame(page);await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});}await page.evaluate(()=>document.fonts.ready);if(!keepTitle)await page.locator('#title-enter').press('Enter');}
async function showPlay(page){await page.locator('#lobby-play-tab').click();}
async function showAthletes(page){await page.locator('#lobby-athlete-tab').click();}
async function chooseAthlete(page,id){await showAthletes(page);await page.locator('[name=athlete][value='+id+']').check();await showPlay(page);}
async function chooseAIStyle(page,id){await showPlay(page);const details=page.locator('#lobby-opponent');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();await page.locator('[name=ai-style][value='+id+']').check();}
function assertRacketContact(racket) {
 const dx=racket.impact.x-racket.shoulderScreen.x,dy=racket.impact.y-racket.shoulderScreen.y;
 const ratio=Math.min(1,119*racket.scale*.85/Math.hypot(dx,dy));
 const x=racket.shoulderScreen.x+dx*ratio,y=racket.shoulderScreen.y+dy*ratio;
 assert.ok(Math.hypot(racket.x-x,racket.y-y)<.001,'racket should reach toward the impact without extending the arm');
}
module.exports={load,showPlay,showAthletes,chooseAthlete,chooseAIStyle,assertRacketContact};
