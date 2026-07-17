import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{ width:1440, height:900 } });
const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('http://localhost:4321/servicios/produccion-creativa/', { waitUntil:'networkidle' });
await p.waitForTimeout(500);

// 1) REEL: click Play -> does the video advance (not stuck)?
await p.click('[data-svc-more]'); await p.waitForTimeout(1500);
await p.click('[data-svc-bigplay]'); await p.waitForTimeout(700);
const v1 = await p.$eval('[data-svc-feature-video]', v=>({paused:v.paused,t:+v.currentTime.toFixed(2),rs:v.readyState}));
await p.waitForTimeout(900);
const v2 = await p.$eval('[data-svc-feature-video]', v=>({paused:v.paused,t:+v.currentTime.toFixed(2)}));
console.log('REEL video advancing?', JSON.stringify(v1), '->', JSON.stringify(v2), 'ADVANCES:', v2.t>v1.t);

// 2) MANIFESTO: background canvas + phrase
const abs = await p.$eval('[data-reel-manifesto]', el=>el.getBoundingClientRect().top + scrollY);
const H = await p.$eval('[data-reel-manifesto]', el=>el.offsetHeight);
await p.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}), Math.round(abs+(H-900)*0.5));
await p.waitForTimeout(1200);
const bg = await p.$eval('.reel-manifesto-bg', el=>({w:el.width,h:el.height,hasCtx: !!el.getContext}));
const phrase = await p.$$eval('.reel-word', els=>els.map(e=>e.textContent).join(' '));
const litColor = await p.$eval('.reel-word.lit', el=>getComputedStyle(el).color).catch(()=>'none');
console.log('MANIFESTO canvas:', JSON.stringify(bg));
console.log('MANIFESTO phrase:', JSON.stringify(phrase));
console.log('MANIFESTO lit color:', litColor);
await p.screenshot({ path:'/tmp/claude-0/-home-user-Web-Page-FinalEdge-Redesign/f7589625-7599-5de6-9a12-fd16201d299a/scratchpad/proof.png' });
console.log('ERRORS:', errs.length?errs.slice(0,3).join(' | '):'none');
await b.close();
