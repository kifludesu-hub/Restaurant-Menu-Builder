let restaurant=null, categories=[], items=[];
const money=n=>`${Number(n||0).toFixed(2)} ETB`;
async function requireUser(){
  const {data:{user}}=await desuSupabase.auth.getUser();
  if(!user){location.href="/login.html";return null} return user;
}
async function loadDashboard(){
  const user=await requireUser(); if(!user)return;
  const {data:r,error}=await desuSupabase.from("restaurants").select("*").eq("owner_id",user.id).maybeSingle();
  if(error||!r){document.body.innerHTML="<main class='auth-shell'><div class='auth-card'><h1>No restaurant found</h1><p>Create an account again or contact admin.</p></div></main>";return}
  restaurant=r;
  document.querySelector("#restaurantName").textContent=r.name;
  document.querySelector("#planText").textContent=`Plan: ${r.plan||"FREE"} • Status: ${r.subscription_status||"ACTIVE"}`;
  document.querySelector("#rName").value=r.name||"";
  document.querySelector("#rSlug").value=r.slug||"";
  document.querySelector("#rAddress").value=r.address||"";
  document.querySelector("#rPhone").value=r.phone||"";
  const url=`${location.origin}/m/${r.slug}`;
  const link=document.querySelector("#publicLink");link.href=url;
  new QRCode(document.querySelector("#qrBox"),{text:url,width:128,height:128});
  await loadMenu();
}
async function loadMenu(){
  const {data:c,error}=await desuSupabase.from("categories").select("*").eq("restaurant_id",restaurant.id).order("position");
  if(error){alert(error.message);return} categories=c||[];
  const ids=categories.map(x=>x.id);
  items=ids.length?(await desuSupabase.from("menu_items").select("*").in("category_id",ids).order("position")).data||[]:[];
  renderEditor();
}
function renderEditor(){
  const root=document.querySelector("#menuEditor");
  root.innerHTML="";
  categories.forEach(c=>{
    const box=document.createElement("div");box.className="category";
    box.innerHTML=`<div class="category-head"><input data-cat-name="${c.id}" value="${esc(c.name)}"><button class="btn danger" data-del-cat="${c.id}">Delete category</button></div><div class="items" id="items-${c.id}"></div><div class="items"><button class="btn" data-add-item="${c.id}">+ Add item</button></div>`;
    root.appendChild(box);
    const list=box.querySelector(`#items-${c.id}`);
    items.filter(i=>i.category_id===c.id).forEach(i=>list.appendChild(itemRow(i)));
  });
  root.querySelectorAll("[data-cat-name]").forEach(el=>el.addEventListener("change",async()=>{await desuSupabase.from("categories").update({name:el.value.trim()||"Untitled"}).eq("id",el.dataset.catName)}));
  root.querySelectorAll("[data-del-cat]").forEach(el=>el.addEventListener("click",async()=>{if(confirm("Delete this category and its items?")){await desuSupabase.from("categories").delete().eq("id",el.dataset.delCat);await loadMenu()}}));
  root.querySelectorAll("[data-add-item]").forEach(el=>el.addEventListener("click",()=>addItem(el.dataset.addItem)));
}
function itemRow(i){
  const d=document.createElement("div");d.className="item-row";
  d.innerHTML=`<input class="wide" data-field="name" value="${esc(i.name)}" placeholder="Food name"><input class="wide" data-field="description" value="${esc(i.description||"")}" placeholder="Description"><input data-field="price" type="number" min="0" step=".01" value="${i.price}" placeholder="Price"><select data-field="available"><option value="true" ${i.available!==false?"selected":""}>Available</option><option value="false" ${i.available===false?"selected":""}>Unavailable</option></select><button class="btn danger" data-delete>Delete</button>`;
  const save=async()=>{const p=Number(d.querySelector('[data-field="price"]').value);await desuSupabase.from("menu_items").update({name:d.querySelector('[data-field="name"]').value.trim(),description:d.querySelector('[data-field="description"]').value.trim(),price:Number.isFinite(p)?p:0,available:d.querySelector('[data-field="available"]').value==="true"}).eq("id",i.id)};
  d.querySelectorAll("input,select").forEach(x=>x.addEventListener("change",save));
  d.querySelector("[data-delete]").addEventListener("click",async()=>{await desuSupabase.from("menu_items").delete().eq("id",i.id);await loadMenu()});
  return d;
}
async function addItem(categoryId){
  const count=items.filter(x=>x.category_id===categoryId).length;
  const {error}=await desuSupabase.from("menu_items").insert({category_id:categoryId,name:"New menu item",description:"",price:0,available:true,position:count});
  if(error)alert(error.message);else await loadMenu();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
document.querySelector("#logout").addEventListener("click",async()=>{await desuSupabase.auth.signOut();location.href="/login.html"});
document.querySelector("#addCategory").addEventListener("click",async()=>{const {error}=await desuSupabase.from("categories").insert({restaurant_id:restaurant.id,name:"New category",position:categories.length});if(error)alert(error.message);else await loadMenu()});
document.querySelector("#restaurantForm").addEventListener("submit",async e=>{e.preventDefault();const slug=document.querySelector("#rSlug").value.trim().toLowerCase();const {error}=await desuSupabase.from("restaurants").update({name:document.querySelector("#rName").value.trim(),slug,address:document.querySelector("#rAddress").value.trim(),phone:document.querySelector("#rPhone").value.trim()}).eq("id",restaurant.id);if(error)alert(error.message);else{alert("Saved");location.reload()}});
document.querySelectorAll("[data-plan]").forEach(b=>b.addEventListener("click",async()=>{const msg=document.querySelector("#paymentMsg");msg.textContent="Creating payment…";try{const {data:{session}}=await desuSupabase.auth.getSession();const res=await fetch("/api/chapa/initialize",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({plan:b.dataset.plan})});const j=await res.json();if(!res.ok)throw new Error(j.error||"Payment initialization failed");location.href=j.checkout_url}catch(e){msg.textContent=e.message}}));
loadDashboard();
document.querySelector("#uploadLogo").addEventListener("click",async()=>{
 const file=document.querySelector("#logoFile").files[0],msg=document.querySelector("#logoMsg");
 if(!file){msg.textContent="Choose an image first.";return}
 if(file.size>3*1024*1024){msg.textContent="Image must be 3 MB or smaller.";return}
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)){msg.textContent="Use PNG, JPG or WebP.";return}
 msg.textContent="Uploading…";
 const path=`${restaurant.id}/logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"")}`;
 const {error}=await desuSupabase.storage.from("menu-images").upload(path,file,{upsert:true,contentType:file.type});
 if(error){msg.textContent=error.message;return}
 const {data}=desuSupabase.storage.from("menu-images").getPublicUrl(path);
 const {error:uerr}=await desuSupabase.from("restaurants").update({logo_url:data.publicUrl}).eq("id",restaurant.id);
 msg.textContent=uerr?uerr.message:"Logo uploaded.";
});
