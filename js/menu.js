async function loadPublicMenu(){
 const root=document.querySelector("#menuRoot"),p=new URLSearchParams(location.search);
 if(p.get("demo")==="1"){renderDemo(root);return}
 const slug=(location.pathname.match(/^\/m\/([^/]+)/)||[])[1]||p.get("slug");
 if(!slug){root.innerHTML="<div class='error'>Menu link is missing.</div>";return}
 const {data:r,error}=await desuSupabase.from("restaurants").select("id,name,slug,address,phone,logo_url,subscription_status").eq("slug",slug).maybeSingle();
 if(error||!r){root.innerHTML="<div class='error'>Restaurant not found.</div>";return}
 if(r.subscription_status==="SUSPENDED"){root.innerHTML="<div class='error'>This menu is temporarily unavailable.</div>";return}
 const {data:c}=await desuSupabase.from("categories").select("*").eq("restaurant_id",r.id).order("position");
 const ids=(c||[]).map(x=>x.id);const {data:i}=ids.length?await desuSupabase.from("menu_items").select("*").in("category_id",ids).order("position"):{data:[]};
 renderMenu(root,r,c||[],i||[]);
}
function renderMenu(root,r,c,items){
 root.innerHTML=`<header class="menu-header">${r.logo_url?`<img class="menu-logo" src="${esc(r.logo_url)}" alt="">`:""}<h1>${esc(r.name)}</h1><p class="muted">${esc(r.address||"Digital menu")}</p>${r.phone?`<p class="small">${esc(r.phone)}</p>`:""}</header><div id="cats"></div><p class="small muted" style="text-align:center;margin-top:40px">Powered by DESU Digital Menu</p>`;
 const cats=root.querySelector("#cats");c.forEach(cat=>{const section=document.createElement("section");section.className="menu-category";section.innerHTML=`<h2>${esc(cat.name)}</h2>`;items.filter(x=>x.category_id===cat.id).forEach(x=>{const row=document.createElement("article");row.className=`food ${x.available===false?"soldout":""}`;row.innerHTML=`<div class="food-main"><h3>${esc(x.name)}</h3><p>${esc(x.description||"")}</p><div class="price">${money(x.price)}</div></div>${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.name)}">`:""}`;section.appendChild(row)});cats.appendChild(section)});
}
function renderDemo(root){renderMenu(root,{name:"Ababa Restaurant",address:"Addis Ababa",phone:"+251 900 000 000",logo_url:""},[{id:"1",name:"Burgers",position:0},{id:"2",name:"Drinks",position:1}],[{category_id:"1",name:"Classic Burger",description:"Beef, lettuce and tomato",price:250,available:true},{category_id:"1",name:"Cheese Burger",description:"Classic burger with cheese",price:300,available:true},{category_id:"2",name:"Fresh Juice",description:"Seasonal fruit juice",price:120,available:true}])}
const money=n=>`${Number(n||0).toFixed(2)} ETB`;const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));loadPublicMenu();