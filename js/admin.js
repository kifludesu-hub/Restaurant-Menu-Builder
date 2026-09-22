async function initAdmin(){
 const {data:{user}}=await desuSupabase.auth.getUser();if(!user){location.href="/login.html";return}
 const {data:p}=await desuSupabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(!p||p.role!=="admin"){document.querySelector(".dashboard").innerHTML="<section class='panel'><h1>Access denied</h1><p>Your account is not a platform administrator.</p></section>";return}
 const [{count:rc},{count:uc},{count:pc}]=await Promise.all([
  desuSupabase.from("restaurants").select("*",{count:"exact",head:true}),
  desuSupabase.from("profiles").select("*",{count:"exact",head:true}),
  desuSupabase.from("payments").select("*",{count:"exact",head:true}).eq("status","success")
 ]);
 document.querySelector("#stats").innerHTML=`<div class="stat"><b>Restaurants</b><div>${rc??0}</div></div><div class="stat"><b>Users</b><div>${uc??0}</div></div><div class="stat"><b>Successful payments</b><div>${pc??0}</div></div>`;
 const {data:rs}=await desuSupabase.from("restaurants").select("id,name,slug,plan,subscription_status,created_at").order("created_at",{ascending:false}).limit(100);
 document.querySelector("#restaurants").innerHTML=(rs||[]).map(r=>`<div class="plan"><b>${esc(r.name)}</b><span>${esc(r.slug)} • ${r.plan||"FREE"} • ${r.subscription_status||"ACTIVE"}</span><a href="/m/${encodeURIComponent(r.slug)}" target="_blank">Open menu</a></div>`).join("");
}
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));document.querySelector("#logout").addEventListener("click",async()=>{await desuSupabase.auth.signOut();location.href="/login.html"});initAdmin();