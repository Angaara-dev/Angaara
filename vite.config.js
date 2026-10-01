import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { wasm } from '@rollup/plugin-wasm';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import inject from '@rollup/plugin-inject';
import topLevelAwait from 'vite-plugin-top-level-await';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import buildConfig from './build.config';

// Lets Element Call use AES-256 frame keys when the app asks for it (angaaraKeySize=256 in the
// widget URL). Fails the build if the bundle changed, so calls never quietly stay on AES-128.
// Runs first in the call frame: mixes soundboard audio into the mic so people on other apps
// hear it (plain mic if the mixer can't start), and keeps the call's connections for ping stats.
const MIC_MIX = `(()=>{try{const md=navigator.mediaDevices;if(!md||!md.getUserMedia)return;
const real=md.getUserMedia.bind(md);let ctx;let dest;
globalThis.__angaaraMix={ready:()=>!!(ctx&&dest&&ctx.state==='running'),
play:async(bytes)=>{if(!ctx||!dest||ctx.state!=='running')return false;
const src=ctx.createBufferSource();src.buffer=await ctx.decodeAudioData(bytes);
src.connect(dest);src.start();src.stop(ctx.currentTime+10);return true;}};
md.getUserMedia=async(c)=>{const s=await real(c);if(!c||!c.audio)return s;
try{const mic=s.getAudioTracks()[0];if(!mic)return s;ctx=ctx||new AudioContext();
if(ctx.state!=='running')await Promise.race([ctx.resume(),new Promise((r)=>setTimeout(r,300))]);
if(ctx.state!=='running')return s;const d=ctx.createMediaStreamDestination();
ctx.createMediaStreamSource(new MediaStream([mic])).connect(d);const out=d.stream.getAudioTracks()[0];
const stop=out.stop.bind(out);out.stop=()=>{stop();mic.stop();};
out.getSettings=()=>mic.getSettings();out.getConstraints=()=>mic.getConstraints();
out.getCapabilities=()=>(mic.getCapabilities?mic.getCapabilities():{});
out.applyConstraints=(x)=>mic.applyConstraints(x);
Object.defineProperty(out,'label',{get:()=>mic.label});
mic.addEventListener('ended',()=>{stop();out.dispatchEvent(new Event('ended'));});
dest=d;return new MediaStream([out,...s.getVideoTracks()]);}catch(e){return s;}};}catch(e){}})();
(()=>{try{const PC=globalThis.RTCPeerConnection;if(!PC)return;const pcs=[];globalThis.__angaaraPcs=pcs;
globalThis.RTCPeerConnection=new Proxy(PC,{construct(t,a){const pc=new t(...a);pcs.push(pc);
pc.addEventListener('connectionstatechange',()=>{if(pc.connectionState==='closed'){const i=pcs.indexOf(pc);if(i>=0)pcs.splice(i,1);}});
return pc;}});}catch(e){}})();
globalThis.__angaaraOnePerUser=(ms,me)=>{try{const live=(m)=>{const p=m.participant&&m.participant.value$&&m.participant.value$.value;
return p?(p.isCameraEnabled||p.isScreenShareEnabled?2:1):0;};const best=new Map();ms.forEach((m)=>{if(me&&m.userId===me.userId)return;
const b=best.get(m.userId);if(!b||live(m)>=live(b))best.set(m.userId,m);});return ms.filter((m)=>best.get(m.userId)===m);}catch(e){return ms;}};`;

// One tile per person: a user's other devices fold into the tile of the one sending media.
function patchOneTilePerUser(code) {
  const at = code.search(/`CallViewModel userMedia\$`,function\*\(\[\w+,/);
  if (at < 0) return undefined;
  const local = code.slice(at).match(/function\*\(\[(\w+),/)[1];
  const head = code.slice(at, at + 400);
  const filter = /(\w+)=(\w+\.value\.filter\((\w+)=>\w+\(\3\)!==\w+\))/;
  if (!filter.test(head)) return undefined;
  return (
    code.slice(0, at) +
    head.replace(filter, `$1=__angaaraOnePerUser($2,${local})`) +
    code.slice(at + 400)
  );
}

// Two people sit side by side in the grid, instead of one big tile with yourself floating on it.
function patchSideBySide(code) {
  const grid = /case`grid`:return \w+\.pipe\((\w+)\(e=>e===null\?(\w+):(\w+)\(e\)\)\)/;
  const narrow = /case`narrow`:return \w+\.pipe\((\w+)\(e=>e===null\?/;
  const m = code.match(grid);
  if (!m || !narrow.test(code)) return undefined;
  return code
    .replace(grid, `case\`grid\`:return ${m[2]}`)
    .replace(narrow, `case\`narrow\`:return ${m[3]}(null).pipe($1(e=>e===null?`);
}

// Tags each tile with its user, so the app can colour it to match their profile.
function tagTilesWithUser(code) {
  const at = code.indexOf('"data-testid":`videoTile`,"data-video-fit":');
  if (at < 0) return undefined;
  const ids = [...code.slice(0, at).matchAll(/userId:(\w+),videoEnabled:/g)];
  const userVar = ids[ids.length - 1]?.[1];
  if (!userVar) return undefined;
  const fit = code.slice(at).match(/^"data-testid":`videoTile`,"data-video-fit":\w+/)[0];
  return `${code.slice(0, at)}${fit},"data-angaara-user":${userVar}${code.slice(at + fit.length)}`;
}

// Hands the app Element Call's mic/speaker settings so it can switch them mid-call.
function exposeDeviceSettings(code) {
  const m = code.match(
    /(\w+)=new (\w+)\(`audio-input`,void 0\),(\w+)=new \2\(`audio-output`,void 0\)/
  );
  if (!m) return undefined;
  return `${code}\n;globalThis.__angaaraDevices={input:${m[1]},output:${m[3]}};`;
}

function patchElementCallKeySize() {
  return {
    name: 'patch-element-call-key-size',
    apply: 'build',
    closeBundle() {
      const dir = path.resolve('dist/public/element-call/assets');
      const files = fs.readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f));
      const keySize = 'globalThis.__angaaraKeySize||128';
      let patched = 0;
      files.forEach((file) => {
        const target = path.join(dir, file);
        let code = fs.readFileSync(target, 'utf8');
        const workerAt = code.indexOf('livekit-client.e2ee.worker');
        const defaults = code.indexOf('keySize:128}');
        const keyGen = /generateRandomKey\(\)\{var (\w+)=new Uint8Array\(16\)/;
        if (defaults < 0 || (workerAt >= 0 && defaults > workerAt) || !keyGen.test(code)) return;
        code = `${code.slice(0, defaults)}keySize:(${keySize})}${code.slice(defaults + 12)}`;
        code = code.replace(keyGen, `generateRandomKey(){var $1=new Uint8Array((${keySize})/8)`);
        const merged = patchOneTilePerUser(code);
        if (merged) code = merged;
        else
          console.warn('Element Call tile merge patch did not apply; devices get their own tiles');
        const sideBySide = patchSideBySide(code);
        if (sideBySide) code = sideBySide;
        else console.warn('Element Call side-by-side patch did not apply; 1:1 calls float you');
        const tagged = tagTilesWithUser(code);
        if (tagged) code = tagged;
        else console.warn('Element Call tile user patch did not apply; tiles stay grey');
        const devices = exposeDeviceSettings(code);
        if (devices) code = devices;
        else console.warn('Element Call device patch did not apply; device changes need a rejoin');
        code = `${MIC_MIX}globalThis.__angaaraKeySize=new URLSearchParams(location.search).get('angaaraKeySize')==='256'?256:128;${code}`;
        fs.writeFileSync(target, code);
        patched += 1;
      });
      if (patched !== 1)
        throw new Error(`Element Call key size patch applied ${patched} times, expected 1`);
    },
  };
}

const copyFiles = {
  targets: [
    {
      src: 'node_modules/@element-hq/element-call-embedded/dist/*',
      dest: 'public/element-call',
    },
    {
      src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
      dest: '',
      rename: 'pdf.worker.min.js',
    },
    {
      src: 'config.json',
      dest: '',
    },
    {
      src: 'public/manifest.json',
      dest: '',
    },
    {
      src: 'public/bot-sso.html',
      dest: '',
    },
    {
      src: 'public/terms.html',
      dest: '',
    },
    {
      // Cloudflare reads this for security headers; it's never served itself.
      src: 'public/_headers',
      dest: '',
    },
    {
      // Malware rules for File Check, loaded only when a file is checked.
      src: 'public/yara',
      dest: '',
    },
    {
      // Soundboard starter pack.
      src: 'public/sounds',
      dest: '',
    },
    {
      src: 'public/res/android',
      dest: 'public/',
    },
    {
      src: 'public/locales',
      dest: 'public/',
    },
  ],
};

function serverMatrixSdkCryptoWasm(wasmFilePath) {
  return {
    name: 'vite-plugin-serve-matrix-sdk-crypto-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === wasmFilePath) {
          const resolvedPath = path.join(
            path.resolve(),
            '/node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm'
          );

          if (fs.existsSync(resolvedPath)) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'no-cache');

            const fileStream = fs.createReadStream(resolvedPath);
            fileStream.pipe(res);
          } else {
            res.writeHead(404);
            res.end('File not found');
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  appType: 'spa',
  publicDir: false,
  base: buildConfig.base,
  server: {
    port: 8080,
    host: true,
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  plugins: [
    serverMatrixSdkCryptoWasm('/node_modules/.vite/deps/pkg/matrix_sdk_crypto_wasm_bg.wasm'),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: '__tla',
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: (i) => `__tla_${i}`,
    }),
    viteStaticCopy(copyFiles),
    patchElementCallKeySize(),
    vanillaExtractPlugin(),
    wasm(),
    react(),
    VitePWA({
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        // Enable esbuild polyfill plugins
        NodeGlobalsPolyfillPlugin({
          process: false,
          buffer: true,
        }),
      ],
    },
  },
  // Module workers: the matrix-js-sdk sync-store worker needs code splitting.
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    copyPublicDir: false,
    rollupOptions: {
      plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],
    },
  },
});
