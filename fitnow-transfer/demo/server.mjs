import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const files={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.mjs':'app.mjs','/engine.mjs':'engine.mjs','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg'};
const types={html:'text/html',css:'text/css',mjs:'text/javascript',webmanifest:'application/manifest+json',svg:'image/svg+xml'};
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 let path;try{path=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end();return;}
 const f=files[path];if(!f){res.writeHead(404);res.end('Not found');return;}
 try{const data=await readFile(join(root,f));res.writeHead(200,{'Content-Type':types[f.split('.').pop()]+'; charset=utf-8','Content-Security-Policy':"default-src 'self'; connect-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(500);res.end('Unavailable');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Local demo only at http://127.0.0.1:'+server.address().port));
