import { createClient } from "@supabase/supabase-js";
const plans={BASIC:{amount:"100",name:"Basic"},PRO:{amount:"250",name:"Pro"}};
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}})}
export default async function handler(req){
 if(req.method!=="POST")return json({error:"POST only"},405);
 const auth=req.headers.get("authorization")||"";const token=auth.replace(/^Bearer\s+/i,"");
 if(!token)return json({error:"Authentication required"},401);
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.CHAPA_SECRET_KEY)return json({error:"Server environment is not configured"},500);
 const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data:{user},error:uerr}=await admin.auth.getUser(token);if(uerr||!user)return json({error:"Invalid session"},401);
 let body;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const plan=plans[body.plan];if(!plan)return json({error:"Invalid plan"},400);
 const {data:r,error:rerr}=await admin.from("restaurants").select("id,name,owner_id").eq("owner_id",user.id).maybeSingle();
 if(rerr||!r)return json({error:"Restaurant not found"},404);
 const txRef=`desu_${r.id.slice(0,8)}_${Date.now()}`;
 const origin=new URL(req.url).origin;
 const {data:payment,error:perr}=await admin.from("payments").insert({restaurant_id:r.id,tx_ref:txRef,plan:body.plan,amount:Number(plan.amount),currency:"ETB",status:"pending"}).select().single();
 if(perr)return json({error:perr.message},500);
 const chapaBody={amount:plan.amount,currency:"ETB",email:user.email,first_name:(user.user_metadata?.full_name||r.name).split(" ")[0],last_name:(user.user_metadata?.full_name||"Restaurant").split(" ").slice(1).join(" ")||"Owner",tx_ref:txRef,callback_url:`${origin}/api/chapa/callback?tx_ref=${encodeURIComponent(txRef)}`,return_url:`${origin}/dashboard.html?payment=return&tx_ref=${encodeURIComponent(txRef)}`,customization:{title:"DESU Digital Menu",description:`${plan.name} subscription`}};
 const response=await fetch("https://api.chapa.co/v1/transaction/initialize",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.CHAPA_SECRET_KEY}`},body:JSON.stringify(chapaBody)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.status!=="success"){await admin.from("payments").update({status:"failed",provider_response:result}).eq("id",payment.id);return json({error:result.message||"Chapa initialization failed",details:result},502)}
 await admin.from("payments").update({provider_response:result}).eq("id",payment.id);
 return json({checkout_url:result.data?.checkout_url,tx_ref:txRef});
}