"use strict";
const $ = id => document.getElementById(id);
const STORAGE = {users:"oluzbUsersV3",current:"oluzbCurrentUserV3",ads:"oluzbListingsV3",favorites:"oluzbFavoritesV3",location:"oluzbLocationV3",cart:"oluzbCartV3",orders:"oluzbOrdersV3"};
const categories=["Telefonlar","Elektronika","Kiyim-kechak","Uy-ro‘zg‘or","Go‘zallik","Bolalar","Avtomobil","Sport","Boshqa"];
const regions=["Andijon viloyati","Buxoro viloyati","Farg‘ona viloyati","Jizzax viloyati","Xorazm viloyati","Namangan viloyati","Navoiy viloyati","Qashqadaryo viloyati","Qoraqalpog‘iston Respublikasi","Samarqand viloyati","Sirdaryo viloyati","Surxondaryo viloyati","Toshkent viloyati","Toshkent shahri"];
const read=(key,fallback=[])=>{try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{alert("Brauzer xotirasi to'ldi. Rasmlar hajmini kamaytiring yoki ayrim e'lonlarni o'chiring.");return false}};
const SUPABASE_URL = "https://zesghyuircjttqevwnzu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_i6eIcwib6XbA4-w75FLgfQ_LT3o_qmP";
if (!window.supabase?.createClient) {
  alert("Supabase kutubxonasi yuklanmadi. Internet aloqasini tekshiring.");
  throw new Error("Supabase JS library is unavailable");
}
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let ads=read(STORAGE.ads),favorites=read(STORAGE.favorites),cart=read(STORAGE.cart),orders=read(STORAGE.orders);
if(!Array.isArray(ads))ads=[];if(!Array.isArray(favorites))favorites=[];if(!Array.isArray(cart))cart=[];if(!Array.isArray(orders))orders=[];
let currentUser=null;
let activeCategory="Barchasi",activeType="all",authMode="register",editingAdId=null;

function formatPrice(n){return Number(n||0).toLocaleString("uz-UZ")+" so'm"}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function openModal(id){$(id).classList.add("open");$(id).setAttribute("aria-hidden","false")}
function closeModal(id){$(id).classList.remove("open");$(id).setAttribute("aria-hidden","true")}
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)closeModal(o.id)}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".overlay.open").forEach(o=>closeModal(o.id))});

function fillSelect(id,placeholder){const el=$(id);if(!el)return;el.innerHTML=`<option value="">${placeholder}</option>`+regions.map(r=>`<option value="${safe(r)}">${safe(r)}</option>`).join("")}
["userRegion","adRegion","locationRegion"].forEach(id=>fillSelect(id,"Viloyat yoki shaharni tanlang"));
$("adCategory").innerHTML='<option value="">Kategoriyani tanlang</option>'+categories.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join("");

function userLocation(){return currentUser?.location||read(STORAGE.location,{})}
function updateHeader(){
 $("accountBtn").textContent=currentUser?`👤 ${currentUser.name.split(" ")[0]}`:"👤 Kirish";
 $("favoriteCount").textContent=favorites.length;
 $("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0);
 const loc=userLocation();$("headerLocation").textContent=loc?.region?(loc.region+(loc.district?", "+loc.district:"")):"Manzilni tanlang";
}
function setAuthMode(mode){
 authMode=mode;const reg=mode==="register";
 $("authTitle").textContent=reg?"Ro'yxatdan o'tish":"Hisobga kirish";
 $("registerTab").classList.toggle("active",reg);$("loginTab").classList.toggle("active",!reg);
 $("registerLocationFields").hidden=!reg;$("nameField").hidden=!reg;
 $("userPhone").closest("label").hidden=!reg;
 ["userName","userPhone","userRegion","userDistrict","userAddress"].forEach(id=>$(id).required=reg);
 $("userEmail").required=true;
 $("userPassword").autocomplete=reg?"new-password":"current-password";
 $("authSubmit").textContent=reg?"Ro'yxatdan o'tish":"Kirish";
}
$("registerTab").addEventListener("click",()=>setAuthMode("register"));$("loginTab").addEventListener("click",()=>setAuthMode("login"));
$("accountBtn").addEventListener("click",()=>{if(currentUser)showProfile();else{setAuthMode("register");openModal("authModal")}});
async function loadUserProfile(authUser){
 const meta=authUser.user_metadata||{};
 const payload={id:authUser.id,full_name:meta.full_name||authUser.email?.split("@")[0]||"OLUZB foydalanuvchisi",phone:meta.phone||"",region:meta.region||"",district:meta.district||"",address:meta.address||""};
 let {data,error}=await supabaseClient.from("profiles").select("id,full_name,phone,region,district,address").eq("id",authUser.id).maybeSingle();
 if(error) throw error;
 if(!data){
  const inserted=await supabaseClient.from("profiles").upsert(payload).select("id,full_name,phone,region,district,address").single();
  if(inserted.error) throw inserted.error;
  data=inserted.data;
 }
 currentUser={id:data.id,name:data.full_name||payload.full_name,phone:data.phone||"",email:authUser.email||"",location:{region:data.region||"",district:data.district||"",address:data.address||""}};
 updateHeader();
}
$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const email=$("userEmail").value.trim().toLowerCase(),password=$("userPassword").value;
 const button=$("authSubmit");button.disabled=true;button.textContent="Kuting...";
 try{
  if(authMode==="register"){
   const metadata={full_name:$("userName").value.trim(),phone:$("userPhone").value.trim(),region:$("userRegion").value,district:$("userDistrict").value.trim(),address:$("userAddress").value.trim()};
   const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:metadata}});
   if(error)throw error;
   if(data.session){
    await loadUserProfile(data.user);
    closeModal("authModal");$("authForm").reset();
    alert("Ro'yxatdan o'tdingiz! OLUZB hisobingiz yaratildi.");
   }else{
    alert("Ro'yxatdan o'tish so'rovi qabul qilindi. Emailingizga tasdiqlash xati yuborildi. Xatdagi havolani bosing, keyin saytga kiring.");
    setAuthMode("login");
   }
  }else{
   const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
   if(error)throw error;
   await loadUserProfile(data.user);
   closeModal("authModal");$("authForm").reset();
   alert("Hisobingizga muvaffaqiyatli kirdingiz.");
  }
 }catch(err){
  console.error("OLUZB auth:",err);
  alert("Xatolik: "+(err.message||"Amalni bajarib bo'lmadi."));
 }finally{
  button.disabled=false;button.textContent=authMode==="register"?"Ro'yxatdan o'tish":"Kirish";
 }
});
supabaseClient.auth.onAuthStateChange((_event,session)=>{
 setTimeout(async()=>{
  try{
   if(session?.user) await loadUserProfile(session.user);
   else{currentUser=null;updateHeader();}
  }catch(err){console.error("Profilni yuklashda xatolik:",err);alert("Profil ma'lumotlarini yuklab bo'lmadi: "+err.message);}
 },0);
});
async function restoreAuthSession(){
 const {data,error}=await supabaseClient.auth.getSession();
 if(error){console.error(error);return;}
 if(data.session?.user){
  try{await loadUserProfile(data.session.user);}
  catch(err){console.error(err);alert("Profilni yuklashda xatolik: "+err.message);}
 }else{currentUser=null;updateHeader();}
}
function requireUser(){if(currentUser)return true;setAuthMode("register");openModal("authModal");alert("Davom etish uchun avval ro'yxatdan o'ting.");return false}
function startPost(){if(!requireUser())return;editingAdId=null;$("listingForm").reset();$("imagePreview").innerHTML="";$("listingModalTitle").textContent="Yangi mahsulot / e'lon";const l=currentUser.location||{};$("adRegion").value=l.region||"";$("adDistrict").value=l.district||"";$("adAddress").value=l.address||"";openModal("listingModal")}
["postAdBtn","heroPostBtn","emptyPostBtn","bannerPostBtn"].forEach(id=>$(id).addEventListener("click",startPost));
$("profilePostBtn").addEventListener("click",()=>{closeModal("profileModal");startPost()});

function readImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)})}
$("adImages").addEventListener("change",()=>{const box=$("imagePreview");box.innerHTML="";Array.from($("adImages").files).slice(0,6).forEach(file=>{const img=document.createElement("img");img.src=URL.createObjectURL(file);box.append(img)})});
$("listingForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!requireUser())return;
 const files=Array.from($("adImages").files);
 if(!editingAdId&&(files.length<1||files.length>6)){alert("1 tadan 6 tagacha rasm tanlang.");return}
 if(files.length>6||files.some(f=>!f.type.startsWith("image/")||f.size>1.5*1024*1024)){alert("Faqat rasm tanlang. Har bir rasm 1.5 MB dan oshmasin.");return}
 try{
  const old=ads.find(a=>a.id===editingAdId);
  const images=files.length?await Promise.all(files.map(readImage)):(old?.images||[]);
  if(!images.length){alert("Kamida bitta rasm tanlang.");return}
  const ad={id:editingAdId||"ad"+Date.now(),userId:currentUser.id,type:$("adType").value,title:$("adTitle").value.trim(),category:$("adCategory").value,price:Number($("adPrice").value),condition:$("adCondition").value,description:$("adDescription").value.trim(),region:$("adRegion").value,district:$("adDistrict").value.trim(),address:$("adAddress").value.trim(),images,phone:currentUser.phone,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
  if(!ad.title||!ad.description||!ad.price||ad.price<1||!ad.region||!ad.district||!ad.address){alert("Barcha majburiy maydonlarni to'ldiring.");return}
  const next=editingAdId?ads.map(a=>a.id===editingAdId?ad:a):[ad,...ads];
  if(!write(STORAGE.ads,next))return;ads=next;editingAdId=null;$("listingForm").reset();$("imagePreview").innerHTML="";closeModal("listingModal");renderAds();alert("E'lon saqlandi!");
 }catch(err){console.error(err);alert("Rasmlarni yuklashda xatolik yuz berdi.")}
});

function filteredAds(){
 const q=$("searchInput").value.trim().toLocaleLowerCase("uz");
 let list=ads.filter(a=>(activeCategory==="Barchasi"||a.category===activeCategory)&&(activeType==="all"||a.type===activeType)&&(!q||(a.title+" "+a.description+" "+a.region+" "+a.district+" "+a.address).toLocaleLowerCase("uz").includes(q)));
 const sort=$("sortSelect").value;if(sort==="cheap")list.sort((a,b)=>a.price-b.price);else if(sort==="expensive")list.sort((a,b)=>b.price-a.price);else list.sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
 return list;
}
function renderAds(){
 const list=$("productList");list.innerHTML="";const shown=filteredAds();
 $("emptyState").hidden=ads.length!==0;$("noResults").hidden=ads.length===0||shown.length!==0;
 shown.forEach(ad=>{
  const card=document.createElement("article");card.className="product-card";
  const image=document.createElement("div");image.className="card-image";const img=document.createElement("img");img.src=ad.images?.[0]||"";img.alt=ad.title;img.onerror=()=>{img.remove();const f=document.createElement("span");f.className="image-fallback";f.textContent="📦";image.prepend(f)};image.append(img);
  const heart=document.createElement("button");heart.className="heart-btn"+(favorites.includes(ad.id)?" active":"");heart.type="button";heart.textContent=favorites.includes(ad.id)?"♥":"♡";heart.setAttribute("aria-label","Sevimlilarga qo'shish");heart.addEventListener("click",()=>toggleFavorite(ad.id));image.append(heart);
  const body=document.createElement("div");body.className="card-body";const type=document.createElement("span");type.className="card-type";type.textContent=ad.type==="shop"?"DO'KON MAHSULOTI":"ODDIY E'LON";
  const title=document.createElement("h3");title.textContent=ad.title;const price=document.createElement("p");price.className="card-price";price.textContent=formatPrice(ad.price);
  const loc=document.createElement("p");loc.className="card-location";loc.textContent="📍 "+ad.region+", "+ad.district;
  const date=document.createElement("p");date.className="card-date";date.textContent=new Date(ad.createdAt).toLocaleDateString("uz-UZ")+" · "+ad.condition;
  const buttons=document.createElement("div");buttons.className="card-buttons";const detail=document.createElement("button");detail.className="card-open";detail.textContent="Batafsil";detail.addEventListener("click",()=>showAdDetails(ad));buttons.append(detail);
  if(ad.type==="shop"){const add=document.createElement("button");add.className="add-cart";add.textContent="🛒 Savatga";add.addEventListener("click",()=>addToCart(ad.id));buttons.append(add)}
  body.append(type,title,price,loc,date,buttons);card.append(image,body);list.append(card);
 });
 updateHeader();
}
document.querySelectorAll(".category").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".category").forEach(x=>x.classList.remove("active"));btn.classList.add("active");activeCategory=btn.dataset.category;renderAds()}));
document.querySelectorAll(".type-tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".type-tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");activeType=btn.dataset.type;renderAds()}));
$("searchInput").addEventListener("input",renderAds);$("searchBtn").addEventListener("click",renderAds);$("sortSelect").addEventListener("change",renderAds);

function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];write(STORAGE.favorites,favorites);renderAds();if($("favoritesModal").classList.contains("open"))renderFavorites()}
function makeManageRow(ad,mode){
 const row=document.createElement("div");row.className="my-listing";const img=document.createElement("img");img.src=ad.images?.[0]||"";const info=document.createElement("div");info.className="my-listing-info";const title=document.createElement("strong");title.textContent=ad.title;const sub=document.createElement("small");sub.textContent=formatPrice(ad.price)+" · "+ad.region+", "+ad.district;info.append(title,sub);row.append(img,info);
 if(mode==="manage"){const edit=document.createElement("button");edit.className="outline-btn";edit.textContent="Tahrirlash";edit.addEventListener("click",()=>editAd(ad.id));const del=document.createElement("button");del.className="delete-btn";del.textContent="O'chirish";del.addEventListener("click",()=>deleteAd(ad.id));row.append(edit,del)}
 else{const view=document.createElement("button");view.className="outline-btn";view.textContent="Ko'rish";view.addEventListener("click",()=>{closeModal("favoritesModal");showAdDetails(ad)});row.append(view)}
 return row;
}
function renderFavorites(){const box=$("favoriteList");box.innerHTML="";const chosen=ads.filter(a=>favorites.includes(a.id));if(!chosen.length){box.textContent="Sevimlilar hozircha bo'sh.";return}chosen.forEach(a=>box.append(makeManageRow(a,"favorite")))}
$("favoritesToggle").addEventListener("click",()=>{renderFavorites();openModal("favoritesModal")});
function showProfile(){
 if(!currentUser)return;$("profileName").textContent=currentUser.name;
 const l=currentUser.location||{};$("profileDetails").textContent=`Telefon: ${currentUser.phone} · Manzil: ${l.region||""}, ${l.district||""}, ${l.address||""}`;
 const box=$("myListings");box.innerHTML="";const mine=ads.filter(a=>a.userId===currentUser.id);if(!mine.length)box.textContent="Siz hali e'lon joylashtirmagansiz.";mine.forEach(a=>box.append(makeManageRow(a,"manage")));
 const orderBox=$("myOrders");orderBox.innerHTML="";const mineOrders=orders.filter(o=>o.userId===currentUser.id);if(!mineOrders.length)orderBox.textContent="Hozircha buyurtmalar yo'q.";mineOrders.forEach(o=>{const p=document.createElement("p");p.className="profile-details";p.textContent=`${new Date(o.createdAt).toLocaleDateString("uz-UZ")} · ${o.items.length} ta mahsulot · ${formatPrice(o.total)} · ${o.status}`;orderBox.append(p)});
 openModal("profileModal");
}
function editAd(id){
 const ad=ads.find(a=>a.id===id);if(!ad||ad.userId!==currentUser?.id)return;closeModal("profileModal");editingAdId=id;$("listingForm").reset();$("listingModalTitle").textContent="E'lonni tahrirlash";
 $("adType").value=ad.type;$("adTitle").value=ad.title;$("adCategory").value=ad.category;$("adPrice").value=ad.price;$("adCondition").value=ad.condition;$("adDescription").value=ad.description;$("adRegion").value=ad.region;$("adDistrict").value=ad.district;$("adAddress").value=ad.address;$("adImages").required=false;
 $("imagePreview").innerHTML="";(ad.images||[]).forEach(src=>{const im=document.createElement("img");im.src=src;$("imagePreview").append(im)});openModal("listingModal");
}
function deleteAd(id){if(!confirm("Ushbu e'lonni o'chirmoqchimisiz?"))return;ads=ads.filter(a=>a.id!==id);favorites=favorites.filter(x=>x!==id);cart=cart.filter(x=>x.id!==id);write(STORAGE.ads,ads);write(STORAGE.favorites,favorites);write(STORAGE.cart,cart);renderAds();showProfile()}
$("logoutBtn").addEventListener("click",async()=>{
 const {error}=await supabaseClient.auth.signOut();
 if(error){alert("Hisobdan chiqishda xatolik: "+error.message);return;}
 currentUser=null;closeModal("profileModal");updateHeader();alert("Hisobdan chiqdingiz.");
});

function showAdDetails(ad){
 $("detailsContent").innerHTML="";
 const layout=document.createElement("div");layout.className="details-layout";const gallery=document.createElement("div");gallery.className="details-gallery";
 (ad.images||[]).forEach(src=>{const im=document.createElement("img");im.src=src;gallery.append(im)});
 const main=document.createElement("div");main.className="details-main";const tag=document.createElement("span");tag.className="card-type";tag.textContent=ad.type==="shop"?"DO'KON MAHSULOTI":"ODDIY E'LON";
 const h=document.createElement("h2");h.textContent=ad.title;const price=document.createElement("p");price.className="card-price";price.textContent=formatPrice(ad.price);
 const desc=document.createElement("p");desc.style.whiteSpace="pre-wrap";desc.textContent=ad.description;
 const meta=document.createElement("p");meta.textContent=`${ad.category} · ${ad.condition} · 📍 ${ad.region}, ${ad.district}, ${ad.address}`;
 const seller=document.createElement("p");seller.textContent="Sotuvchi telefoni: "+ad.phone;
 const actions=document.createElement("div");actions.className="details-actions";
 if(ad.type==="shop"){const add=document.createElement("button");add.className="primary-btn";add.textContent="🛒 Savatga qo'shish";add.addEventListener("click",()=>{addToCart(ad.id);closeModal("detailsModal")});actions.append(add)}
 const call=document.createElement("a");call.className="outline-btn";call.href="tel:"+ad.phone.replace(/[^\d+]/g,"");call.textContent="Sotuvchiga qo'ng'iroq";actions.append(call);
 main.append(tag,h,price,desc,meta,seller,actions);layout.append(gallery,main);$("detailsContent").append(layout);openModal("detailsModal");
}

function addToCart(id){const ad=ads.find(a=>a.id===id);if(!ad||ad.type!=="shop"){alert("Faqat do'kon mahsulotlarini savatga qo'shish mumkin.");return}
 const existing=cart.find(x=>x.id===id);if(existing)existing.qty++;else cart.push({id,qty:1});if(!write(STORAGE.cart,cart))return;renderCart();updateHeader();alert("Mahsulot savatga qo'shildi.")}
function changeQty(id,delta){const item=cart.find(x=>x.id===id);if(!item)return;item.qty+=delta;if(item.qty<=0)cart=cart.filter(x=>x.id!==id);write(STORAGE.cart,cart);renderCart()}
function renderCart(){
 const box=$("cartItems");box.innerHTML="";let total=0;
 cart=cart.filter(item=>ads.some(a=>a.id===item.id&&a.type==="shop"));
 if(!cart.length)box.textContent="Savatingiz hozircha bo'sh.";
 cart.forEach(item=>{const ad=ads.find(a=>a.id===item.id);if(!ad)return;total+=ad.price*item.qty;const row=document.createElement("div");row.className="cart-row";const im=document.createElement("img");im.src=ad.images?.[0]||"";const info=document.createElement("div");info.className="cart-row-info";const title=document.createElement("strong");title.textContent=ad.title;const sub=document.createElement("small");sub.textContent=formatPrice(ad.price);info.append(title,sub);const qty=document.createElement("div");qty.className="qty-controls";const minus=document.createElement("button");minus.className="qty-btn";minus.textContent="−";minus.addEventListener("click",()=>changeQty(ad.id,-1));const number=document.createElement("b");number.textContent=item.qty;const plus=document.createElement("button");plus.className="qty-btn";plus.textContent="+";plus.addEventListener("click",()=>changeQty(ad.id,1));qty.append(minus,number,plus);row.append(im,info,qty);box.append(row)});
 $("cartTotal").textContent=formatPrice(total);$("checkoutBtn").disabled=!cart.length;updateHeader();
}
$("cartToggle").addEventListener("click",()=>{renderCart();openModal("cartModal")});
$("checkoutBtn").addEventListener("click",()=>{if(!cart.length)return;if(currentUser){$("checkoutName").value=currentUser.name;$("checkoutPhone").value=currentUser.phone;const l=currentUser.location||{};$("checkoutAddress").value=[l.region,l.district,l.address].filter(Boolean).join(", ")}closeModal("cartModal");openModal("checkoutModal")});
$("checkoutForm").addEventListener("submit",e=>{
 e.preventDefault();if(!cart.length)return;const items=cart.map(x=>{const a=ads.find(ad=>ad.id===x.id);return a?{id:a.id,title:a.title,price:a.price,qty:x.qty}:null}).filter(Boolean);const total=items.reduce((s,x)=>s+x.price*x.qty,0);
 const order={id:"ord"+Date.now(),userId:currentUser?.id||"",customerName:$("checkoutName").value.trim(),phone:$("checkoutPhone").value.trim(),address:$("checkoutAddress").value.trim(),payment:$("paymentMethod").value,items,total,status:"Qabul qilindi",createdAt:Date.now()};
 const next=[order,...orders];if(!write(STORAGE.orders,next))return;orders=next;cart=[];write(STORAGE.cart,cart);$("checkoutForm").reset();closeModal("checkoutModal");renderCart();alert("Buyurtmangiz demo rejimida qabul qilindi. Haqiqiy to'lov amalga oshirilmadi.");if(currentUser)showProfile();
});

$("locationBtn").addEventListener("click",()=>{const l=userLocation()||{};$("locationRegion").value=l.region||"";$("locationDistrict").value=l.district||"";$("locationAddress").value=l.address||"";openModal("locationModal")});
$("locationForm").addEventListener("submit",e=>{
 e.preventDefault();const loc={region:$("locationRegion").value,district:$("locationDistrict").value.trim(),address:$("locationAddress").value.trim()};
 if(currentUser){currentUser.location=loc;users=users.map(u=>u.id===currentUser.id?currentUser:u);if(!write(STORAGE.users,users))return}
 if(!write(STORAGE.location,loc))return;updateHeader();closeModal("locationModal");renderAds();
});

updateHeader();renderAds();renderCart();setAuthMode("register");restoreAuthSession();
