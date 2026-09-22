export default async function handler(req){
 const url=new URL(req.url);const tx=url.searchParams.get("tx_ref");if(!tx)return new Response("Missing tx_ref",{status:400});
 const origin=url.origin;
 const r=await fetch(`${origin}/api/chapa/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tx_ref:tx})});
 const result=await r.json().catch(()=>({}));
 return new Response(`<!doctype html><html><head><meta http-equiv="refresh" content="2;url=/dashboard.html?payment=callback&status=${encodeURIComponent(result.status||"UNKNOWN")}"></head><body style="font-family:system-ui;padding:40px"><h2>Payment processed</h2><p>You can return to your dashboard.</p></body></html>`,{status:200,headers:{"content-type":"text/html;charset=utf-8"}});
}