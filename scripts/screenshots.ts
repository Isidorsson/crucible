// Drives a headless Edge over CDP to capture README screenshots.
// Run via: bun scripts/screenshots.ts (with dev server already on :5173)

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'docs/screenshots';
const URL = 'http://localhost:5173';
const PORT = 9222;
const VIEWPORT = { width: 1600, height: 1000 };

mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
  '--user-data-dir=' + process.cwd() + '/.tmp-edge',
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchTargets() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) {
        const v = await r.json();
        return v.webSocketDebuggerUrl as string;
      }
    } catch {}
    await sleep(200);
  }
  throw new Error('edge cdp not reachable');
}

type Msg = { id?: number; method?: string; params?: unknown; sessionId?: string; result?: any; error?: any };

class CDP {
  ws: WebSocket;
  nextId = 1;
  pending = new Map<number, (m: Msg) => void>();
  sessionId?: string;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data.toString()) as Msg;
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)!(m);
        this.pending.delete(m.id);
      }
    };
  }
  ready() {
    return new Promise<void>(res => {
      if (this.ws.readyState === 1) return res();
      this.ws.onopen = () => res();
    });
  }
  send(method: string, params: any = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (m) => m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result));
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

async function main() {
  const wsUrl = await fetchTargets();
  const browser = new CDP(wsUrl);
  await browser.ready();
  const { targetInfos } = await browser.send('Target.getTargets');
  const page = targetInfos.find((t: any) => t.type === 'page');
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });

  const cmd = (m: string, p: any = {}) => browser.send(m, p, sessionId);

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false
  });

  async function navigate(url: string) {
    await cmd('Page.navigate', { url });
    await new Promise<void>(res => {
      const off = (m: Msg) => {
        if (m.method === 'Page.loadEventFired') {
          browser.ws.removeEventListener('message', off as any);
          res();
        }
      };
      browser.ws.addEventListener('message', (e) => off(JSON.parse(e.data.toString())));
      setTimeout(res, 5000);
    });
  }

  async function evalJs(expression: string) {
    const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  }

  async function shot(name: string) {
    await sleep(400);
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(r.data, 'base64');
    writeFileSync(`${OUT}/${name}.png`, buf);
    console.log(`saved ${name}.png (${buf.length} bytes)`);
  }

  await navigate(URL);
  await sleep(2500);

  // 1. Empty canvas + palette
  await shot('01-canvas');

  // 2. Open Templates tab, then load a template programmatically by
  //    dispatching the same custom event the drag-drop handler uses.
  await evalJs(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='Templates');b?.click();})()`);
  await sleep(600);
  await shot('02-templates');

  // 3. Run a drill → topology loaded + sim running.
  await evalJs(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='drills');b?.click();})()`);
  await sleep(600);
  await evalJs(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.textContent?.trim()==='run drill');b[0]?.click();})()`);
  await sleep(1500);
  // give sim a couple ticks
  await evalJs(`(()=>{const f=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.toLowerCase().includes('fit'));f?.click();})()`);
  await sleep(1500);
  await shot('03-running');

  // 4. Click a node to populate the Inspector.
  await evalJs(`(()=>{const n=document.querySelector('.svelte-flow__node');n?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));n?.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));n?.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
  await sleep(1200);
  await shot('04-inspector');

  // 5. Fresh page → drag a template onto the canvas, then run.
  await navigate(URL);
  await sleep(2500);
  await evalJs(`(()=>{
    const tab=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Templates');
    tab?.click();
  })()`);
  await sleep(400);
  await evalJs(`(()=>{
    const card=[...document.querySelectorAll('[draggable=true]')].find(el=>/Microservices/i.test(el.textContent||''));
    const pane=document.querySelector('.svelte-flow__pane');
    if(!card||!pane){return 'missing:'+(!card)+'/'+(!pane);}
    const r=pane.getBoundingClientRect();
    const cx=r.left+r.width/2-150, cy=r.top+r.height/2;
    const dt=new DataTransfer();
    dt.setData('application/crucible-template','microservices');
    const fire=(t,el,x,y)=>el.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
    fire('dragstart',card,0,0);
    fire('dragenter',pane,cx,cy);
    fire('dragover',pane,cx,cy);
    fire('drop',pane,cx,cy);
    fire('dragend',card,cx,cy);
    return 'dropped';
  })()`);
  await sleep(800);
  await evalJs(`(()=>{const r=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Run');r?.click();})()`);
  await sleep(2000);
  await evalJs(`(()=>{const f=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.toLowerCase().includes('fit'));f?.click();})()`);
  await sleep(1500);
  await shot('05-template-running');

  await cmd('Browser.close').catch(() => {});
  edge.kill();
  process.exit(0);
}

main().catch(err => { console.error(err); edge.kill(); process.exit(1); });
