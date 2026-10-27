const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const PORT = 4173;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
function getMenu(){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const m=html.match(/const MENU = (\[.*?\]);const menuEl=/s);
 if(!m) throw new Error('No se pudo leer el catálogo de index.html');
 return {html, menu:JSON.parse(m[1]), raw:m[1]};
}
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(obj));}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+PORT);
 if(req.method==='GET' && url.pathname==='/api/products'){
  try {const {menu}=getMenu(); const products=[]; menu.forEach((s,si)=>s.items.forEach((it,ii)=>{if(it.kind==='product')products.push({id:si+'-'+ii,name:it.name,category:s.title,image:it.image||'',details:it.details||'',price:it.price||''});})); return send(res,200,{products});}
  catch(e){return send(res,500,{error:e.message});}
 }
 if(req.method==='POST' && url.pathname==='/api/image'){
  let body=''; req.on('data',chunk=>{body+=chunk;if(body.length>20*1024*1024){req.destroy();}});
  req.on('end',()=>{
   try{
    const data=JSON.parse(body); const {html,menu}=getMenu();
    const [si,ii]=String(data.id||'').split('-').map(Number);
    const item=menu?.[si]?.items?.[ii];
    if(!item || item.kind!=='product') return send(res,400,{error:'Producto no válido'});
    if(typeof data.dataUrl!=='string' || !data.dataUrl.startsWith('data:image/')) return send(res,400,{error:'El archivo no es una imagen válida'});
    const match=data.dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if(!match) return send(res,400,{error:'Formato no compatible. Usa JPG, PNG o WEBP.'});
    const ext=match[1]==='jpeg'?'jpg':match[1]; const bytes=Buffer.from(match[2],'base64');
    if(bytes.length>12*1024*1024) return send(res,400,{error:'La imagen supera los 12 MB'});
    const slug=item.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'producto';
    const filename='custom-'+si+'-'+ii+'-'+slug+'.'+ext;
    const dir=path.join(root,'assets','catalog'); fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,filename),bytes);
    item.image='assets/catalog/'+filename;
    const newRaw=JSON.stringify(menu);
    const updated=html.replace(/const MENU = (\[.*?\]);const menuEl=/s, 'const MENU = '+newRaw+';const menuEl=');
    if(updated===html) {fs.unlinkSync(path.join(dir,filename)); return send(res,500,{error:'No se pudo actualizar el HTML'});}
    fs.writeFileSync(path.join(root,'index.html'),updated,'utf8');
    return send(res,200,{ok:true,name:item.name,image:item.image,message:'Foto guardada permanentemente en la carpeta del proyecto.'});
   }catch(e){return send(res,500,{error:e.message||'Error al guardar'});}
  }); return;
 }
 let pathname=decodeURIComponent(url.pathname); if(pathname==='/') pathname='/index.html';
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep) && file!==path.join(root,'index.html')){res.writeHead(403);return res.end('Forbidden');}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('No encontrado');}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
server.listen(PORT,'127.0.0.1',()=>console.log('KebabRico local: http://127.0.0.1:'+PORT+'  |  Editor de fotos: http://127.0.0.1:'+PORT+'/editar-fotos.html'));
