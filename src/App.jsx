import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';


/* ── Config ── */
const OMDB = "efa53e0d";
const RAWG = "e7838c22d97941a98ccc986a0f3fdd46";
const SB   = "https://ccdxwdtiygttaxalucvx.supabase.co";
const KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZHh3ZHRpeWd0dGF4YWx1Y3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjEwNjcsImV4cCI6MjA4ODY5NzA2N30.kkqY7h59OoBdQroIlueFLMTY6ujBi7N4eCRo9D0RnYA";
const H = t=>({ "Content-Type":"application/json","apikey":KEY,"Authorization":`Bearer ${t||KEY}` });

/* ── Colors ── */
const C = {
  films:  { accent:"#FF453A", light:"rgba(255,69,58,.15)",  label:"Film"  },
  jeux:   { accent:"#BF5AF2", light:"rgba(191,90,242,.15)", label:"Jeu"   },
  livres: { accent:"#32D74B", light:"rgba(50,215,75,.15)",  label:"Livre" },
  partage:{ accent:"#FF9F0A", light:"rgba(255,159,10,.15)", label:"Partage"},
};
const BLUE = "#0A84FF";
const PARTNER_EMAIL = "koolnation@hotmail.fr";

function timeAgo(d){
  if(!d) return "";
  const s=(Date.now()-new Date(d))/1000;
  if(s<60) return "à l'instant";
  if(s<3600) return `il y a ${Math.floor(s/60)}min`;
  if(s<86400) return `il y a ${Math.floor(s/3600)}h`;
  if(s<172800) return "hier";
  if(s<604800) return `il y a ${Math.floor(s/86400)}j`;
  return new Date(d).toLocaleDateString("fr",{day:"numeric",month:"short"});
}

/* ── Data ── */
const STATUTS = {films:["Vu","En cours","À voir"],jeux:["Terminé","En cours","À jouer"],livres:["Lu","En cours","À lire"]};
const SUGGESTED_TAGS = ["Chef-d'œuvre","Culte","Déçu","Surpris","Nostalgique","À revoir","Overrated","Underrated","Coup de cœur","Feelgood"];

const GENRES  = {
  films: ["Action","Comédie","Drame","Horreur","Sci-Fi","Thriller","Animation","Romance","Documentaire","Fantasy"],
  jeux:  ["Action","RPG","FPS","Aventure","Simulation","Sport","Stratégie","Plateforme","Puzzle","Horreur"],
  livres:["Roman","SF","Fantasy","Thriller","Histoire","Biographie","Manga","BD","Essai","Policier"],
};
const TABS = [{id:"dashboard",label:"Dashboard"},{id:"films",label:"Films"},{id:"jeux",label:"Jeux"},{id:"livres",label:"Livres"},{id:"partage",label:"À deux"}];

/* ── API ── */
const authAPI = {
  signIn: async(e,p)=>(await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:"POST",headers:{"Content-Type":"application/json","apikey":KEY},body:JSON.stringify({email:e,password:p})})).json(),
  signOut: t=>fetch(`${SB}/auth/v1/logout`,{method:"POST",headers:H(t)}),
  getUser: async t=>{const r=await fetch(`${SB}/auth/v1/user`,{headers:H(t)});return r.ok?r.json():null;}
};
const db = {
  getAll:      async t=>{const r=await fetch(`${SB}/rest/v1/medias?select=*`,{headers:H(t)});return r.ok?r.json():[];},
  insert:      async(t,d)=>fetch(`${SB}/rest/v1/medias`,{method:"POST",headers:{...H(t),"Prefer":"return=minimal"},body:JSON.stringify(d)}),
  update:      async(t,d)=>fetch(`${SB}/rest/v1/medias?id=eq.${d.id}`,{method:"PATCH",headers:{...H(t),"Prefer":"return=minimal"},body:JSON.stringify(d)}),
  delete:      async(t,id)=>fetch(`${SB}/rest/v1/medias?id=eq.${id}`,{method:"DELETE",headers:H(t)}),
  getShared:   async t=>{const r=await fetch(`${SB}/rest/v1/medias_partages?select=*&order=date_ajout.desc`,{headers:H(t)});return r.ok?r.json():[];},
  addShared:   async(t,d)=>fetch(`${SB}/rest/v1/medias_partages`,{method:"POST",headers:{...H(t),"Prefer":"return=minimal"},body:JSON.stringify(d)}),
  delShared:   async(t,id)=>fetch(`${SB}/rest/v1/medias_partages?id=eq.${id}`,{method:"DELETE",headers:H(t)}),
};

async function searchMedia(type,q){
  if(!q.trim()) return [];
  try{
    if(type==="films"||type==="partage"){
      const r=await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(q)}&type=movie&apikey=${OMDB}`);
      const j=await r.json();
      return j.Search?j.Search.map(m=>({titre:m.Title,annee:m.Year,image:m.Poster!=="N/A"?m.Poster:""})):[];
    }
    if(type==="livres"){
      const r=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6`);
      const j=await r.json();
      return(j.docs||[]).slice(0,6).map(b=>({titre:b.title,annee:b.first_publish_year?.toString()||"",image:b.cover_i?`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`:""}));
    }
    if(type==="jeux"){
      const r=await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(q)}&page_size=6&key=${RAWG}`);
      const j=await r.json();
      return(j.results||[]).map(g=>({titre:g.name,annee:g.released?.slice(0,4)||"",image:g.background_image||""}));
    }
  }catch(e){return [];}
  return [];
}

/* ── Half Stars ── */
function Stars({value=0,onChange,size=16}){
  const [hov,setHov]=useState(0);
  const d=hov||value;
  return(
    <div style={{display:"flex",gap:2,alignItems:"center"}} onMouseLeave={()=>setHov(0)}>
      {[1,2,3,4,5].map(i=>{
        const full=d>=i, half=!full&&d>=i-.5;
        return(
          <span key={i} style={{position:"relative",display:"inline-block",width:size,height:size,cursor:onChange?"pointer":"default"}}>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{position:"absolute"}}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#2c2c2e"/>
            </svg>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{position:"absolute",clipPath:"inset(0 50% 0 0)",opacity:half||full?1:0}}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FFD60A"/>
            </svg>
            <svg width={size} height={size} viewBox="0 0 24 24" style={{position:"absolute",clipPath:"inset(0 0 0 50%)",opacity:full?1:0}}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FFD60A"/>
            </svg>
            {onChange&&<>
              <span style={{position:"absolute",top:0,left:0,width:"50%",height:"100%",zIndex:2}} onMouseEnter={()=>setHov(i-.5)} onClick={()=>onChange(i-.5)}/>
              <span style={{position:"absolute",top:0,left:"50%",width:"50%",height:"100%",zIndex:2}} onMouseEnter={()=>setHov(i)} onClick={()=>onChange(i)}/>
            </>}
          </span>
        );
      })}
      {value>0&&<span style={{fontSize:12,color:"#8e8e93",marginLeft:4}}>{value}</span>}
    </div>
  );
}

/* ── Login ── */
function Login({onLogin}){
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [loading,setL]=useState(false); const [err,setErr]=useState("");
  const submit=async()=>{
    setL(true);setErr("");
    const r=await authAPI.signIn(email,pw);
    if(r.access_token){localStorage.setItem("mc_token",r.access_token);onLogin(r.access_token,r.user);}
    else setErr("Email ou mot de passe incorrect");
    setL(false);
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="scale-in" style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{width:72,height:72,background:"linear-gradient(135deg,#0A84FF,#BF5AF2)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32}}>🎬</div>
          <h1 style={{fontSize:28,fontWeight:700,letterSpacing:-.5}}>MyCulture</h1>
          <p style={{color:"#8e8e93",fontSize:15,marginTop:6}}>Votre collection personnelle</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input className="input-field" type="email" placeholder="Email" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{width:"100%"}}/>
          <input className="input-field" type="password" placeholder="Mot de passe" value={pw}
            onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{width:"100%"}}/>
          {err&&<p style={{color:"#FF453A",fontSize:13,textAlign:"center"}}>{err}</p>}
          <button className="btn-primary" onClick={submit} disabled={loading}
            style={{background:BLUE,color:"#fff",marginTop:4,opacity:loading?.6:1}}>
            {loading?"Connexion…":"Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal ── */
function Modal({item,type,onClose,onSave,saving,userEmail,partnerEmail}){
  const [form,setForm]=useState(item||{titre:"",genre:GENRES[type]?.[0]||"Action",statut:STATUTS[type]?.[0]||"Vu",note:0,note_partner:0,critique:"",annee:"",image:"",plateforme:"",tags:[],favori:false,rewatches:[]});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleTag=t=>setForm(f=>({...f,tags:f.tags?.includes(t)?f.tags.filter(x=>x!==t):[...(f.tags||[]),t]}));
  const [customTag,setCustomTag]=useState("");
  const [showRewatch,setShowRewatch]=useState(false);
  const [rewatchNote,setRewatchNote]=useState(0);
  const isDone=form.statut===STATUTS[type]?.[0];
  const accent=C[type]?.accent||BLUE;

  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.75)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="scale-in card" style={{width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",background:"rgba(28,28,30,0.98)"}}>
        {/* Header with poster */}
        <div style={{position:"relative",height:item?.image?180:80,background:"#1c1c1e",overflow:"hidden",borderRadius:"16px 16px 0 0"}}>
          {item?.image&&<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.5}} onError={e=>e.target.style.display="none"}/>}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(28,28,30,1),transparent)",display:"flex",alignItems:"flex-end",padding:"16px 20px",justifyContent:"space-between"}}>
            <div>
              <span className="tag" style={{background:C[type]?.light,color:accent,marginBottom:6}}>{C[type]?.label}</span>
              <h2 style={{fontSize:18,fontWeight:700,marginTop:4,maxWidth:360}} className="lc1">{form.titre||"Nouveau"}</h2>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:50,width:30,height:30,color:"#fff",cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
          </div>
        </div>

        <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
          {/* Genre + Statut */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Genre</label>
              <select className="input-field" value={form.genre} onChange={e=>set("genre",e.target.value)} style={{width:"100%",fontSize:14,padding:"8px 12px"}}>
                {(GENRES[type]||GENRES.films).map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
            {STATUTS[type]&&(
              <div>
                <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Statut</label>
                <select className="input-field" value={form.statut} onChange={e=>set("statut",e.target.value)} style={{width:"100%",fontSize:14,padding:"8px 12px"}}>
                  {STATUTS[type].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Année + plateforme */}
          <div style={{display:"grid",gridTemplateColumns:type==="jeux"?"1fr 1fr":"1fr",gap:10}}>
            <div>
              <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Année</label>
              <input className="input-field" value={form.annee} onChange={e=>set("annee",e.target.value)} placeholder="2024" style={{width:"100%",fontSize:14,padding:"8px 12px"}}/>
            </div>
            {type==="jeux"&&(
              <div>
                <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Plateforme</label>
                <input className="input-field" value={form.plateforme||""} onChange={e=>set("plateforme",e.target.value)} placeholder="PS5, PC…" style={{width:"100%",fontSize:14,padding:"8px 12px"}}/>
              </div>
            )}
          </div>

          {/* Notes — seulement si terminé */}
          {isDone&&(
          <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
            <div>
              <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>
                {userEmail?.split("@")[0]||"Vous"}
              </label>
              <Stars value={form.note} onChange={v=>set("note",v)} size={24}/>
            </div>
            {partnerEmail&&(
              <div>
                <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>
                  {partnerEmail.split("@")[0]}
                </label>
                <Stars value={form.note_partner||0} onChange={v=>set("note_partner",v)} size={24}/>
              </div>
            )}
          </div>
          )}
          {!isDone&&(
            <p style={{fontSize:12,color:"#636366",fontStyle:"italic"}}>
              ⭐ La note sera disponible une fois terminé.
            </p>
          )}

          {/* Rewatched — seulement si terminé et c'est un item existant */}
          {isDone&&item?.id&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <label style={{fontSize:11,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5}}>
                  Revus ({(form.rewatches||[]).length}x)
                </label>
                <button onClick={()=>setShowRewatch(v=>!v)}
                  style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:8,padding:"4px 10px",color:"#8e8e93",fontSize:12,cursor:"pointer"}}>
                  + Ajouter un rewatch
                </button>
              </div>
              {showRewatch&&(
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 12px"}}>
                  <span style={{fontSize:13,color:"#8e8e93",flexShrink:0}}>Note :</span>
                  <Stars value={rewatchNote} onChange={setRewatchNote} size={20}/>
                  <button onClick={()=>{
                    setForm(f=>({...f,rewatches:[...(f.rewatches||[]),{date:new Date().toISOString(),note:rewatchNote}]}));
                    setRewatchNote(0); setShowRewatch(false);
                  }} style={{marginLeft:"auto",background:C[type]?.accent||BLUE,color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    ✓
                  </button>
                </div>
              )}
              {(form.rewatches||[]).length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {form.rewatches.map((r,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,color:"#636366"}}>
                      <span>↩ {new Date(r.date).toLocaleDateString("fr")}</span>
                      {r.note>0&&<Stars value={r.note} size={11}/>}
                      <button onClick={()=>setForm(f=>({...f,rewatches:f.rewatches.filter((_,j)=>j!==i)}))}
                        style={{marginLeft:"auto",background:"none",border:"none",color:"#FF453A",cursor:"pointer",fontSize:13}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>Tags</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
              {SUGGESTED_TAGS.map(t=>{
                const active=(form.tags||[]).includes(t);
                return(
                  <button key={t} onClick={()=>toggleTag(t)}
                    style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${active?C[type]?.accent||BLUE:"rgba(255,255,255,.12)"}`,background:active?(C[type]?.light||"rgba(10,132,255,.15)"):"transparent",color:active?(C[type]?.accent||BLUE):"#8e8e93",fontSize:12,cursor:"pointer",transition:"all .15s"}}>
                    {t}
                  </button>
                );
              })}
            </div>
            {/* Tag custom */}
            <div style={{display:"flex",gap:8}}>
              <input value={customTag} onChange={e=>setCustomTag(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&customTag.trim()){toggleTag(customTag.trim());setCustomTag("");}}}
                placeholder="Ajouter un tag personnalisé…"
                className="input-field" style={{flex:1,fontSize:13,padding:"6px 12px"}}/>
              <button onClick={()=>{if(customTag.trim()){toggleTag(customTag.trim());setCustomTag("");}}}
                style={{background:C[type]?.accent||BLUE,color:"#fff",border:"none",borderRadius:10,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>+</button>
            </div>
            {(form.tags||[]).length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8}}>
                {form.tags.map(t=>(
                  <span key={t} style={{background:C[type]?.light||"rgba(10,132,255,.15)",color:C[type]?.accent||BLUE,borderRadius:20,padding:"3px 10px",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                    {t}
                    <span onClick={()=>toggleTag(t)} style={{cursor:"pointer",opacity:.7,fontSize:13}}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Critique */}
          <div>
            <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Critique</label>
            <textarea className="input-field" rows={3} value={form.critique||""} onChange={e=>set("critique",e.target.value)}
              placeholder="Vos impressions…" style={{width:"100%",resize:"none",fontSize:14,padding:"8px 12px"}}/>
          </div>

          {/* Image URL */}
          <div>
            <label style={{fontSize:11,color:"#8e8e93",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>URL image</label>
            <input className="input-field" value={form.image||""} onChange={e=>set("image",e.target.value)} placeholder="https://…" style={{width:"100%",fontSize:14,padding:"8px 12px"}}/>
          </div>

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,.08)",border:"none",borderRadius:12,padding:"12px",color:"#f5f5f7",cursor:"pointer",fontSize:15,fontWeight:500}}>Annuler</button>
            <button className="btn-primary" onClick={()=>form.titre&&onSave({...form,id:item?.id||Date.now()})} disabled={saving}
              style={{flex:2,background:accent,color:"#fff",opacity:saving?.6:1}}>
              {saving?"Sauvegarde…":item?"Modifier":"Ajouter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Nav Search Bar ── */
function NavSearch({activeTab,onPick}){
  const [q,setQ]=useState(""); const [res,setRes]=useState([]); const [loading,setL]=useState(false);
  const [open,setOpen]=useState(false); const [focused,setFocused]=useState(false);
  const timer=useRef(); const inputRef=useRef();
  const type=["films","jeux","livres","partage"].includes(activeTab)?activeTab:"films";
  const accent=C[type]?.accent||BLUE;

  useEffect(()=>{
    clearTimeout(timer.current);
    if(q.trim().length<2){setRes([]);return;}
    timer.current=setTimeout(async()=>{setL(true);const d=await searchMedia(type,q);setRes(d);setL(false);},400);
  },[q,type]);

  const pick=item=>{onPick(item,type);setQ("");setRes([]);setOpen(false);};

  // Cmd+K / Ctrl+K
  useEffect(()=>{
    const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setOpen(true);setTimeout(()=>inputRef.current?.focus(),50);}if(e.key==="Escape"){setOpen(false);setQ("");setRes([]);}};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[]);

  return(
    <div style={{position:"relative"}}>
      {/* Collapsed pill */}
      {!open&&(
        <button onClick={()=>{setOpen(true);setTimeout(()=>inputRef.current?.focus(),50);}}
          style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"6px 14px",color:"#8e8e93",fontSize:13,cursor:"pointer",transition:"all .2s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.11)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"}>
          <span style={{fontSize:14}}>🔍</span>
          <span>Rechercher</span>
          <span style={{fontSize:10,background:"rgba(255,255,255,.1)",borderRadius:5,padding:"1px 5px",marginLeft:2}}>⌘K</span>
        </button>
      )}

      {/* Expanded */}
      {open&&(
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#636366",fontSize:14,pointerEvents:"none"}}>🔍</span>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
            onFocus={()=>setFocused(true)}
            onBlur={()=>setTimeout(()=>{setFocused(false);if(!q)setOpen(false);},150)}
            placeholder={`Ajouter un ${C[type]?.label?.toLowerCase()||"film"}… (Esc)`}
            style={{width:280,background:"rgba(44,44,46,.95)",border:`1px solid ${focused?accent+"80":"rgba(255,255,255,.12)"}`,borderRadius:10,padding:"7px 12px 7px 34px",color:"#f5f5f7",fontSize:13,outline:"none",transition:"all .2s"}}/>
          {loading&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#636366",fontSize:11}}>…</span>}
        </div>
      )}

      {/* Dropdown */}
      {res.length>0&&focused&&(
        <div className="fade-in" style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:320,background:"rgba(28,28,30,.98)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,overflow:"hidden",zIndex:200,boxShadow:"0 20px 50px rgba(0,0,0,.7)"}}>
          <div style={{padding:"8px 14px 6px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
            <span style={{fontSize:11,color:"#636366",textTransform:"uppercase",letterSpacing:.5}}>Résultats — {C[type]?.label}</span>
          </div>
          {res.map((r,i)=>(
            <div key={i} onMouseDown={()=>pick(r)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.04)",transition:"background .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:30,height:42,flexShrink:0,borderRadius:5,overflow:"hidden",background:"#2c2c2e"}}>
                {r.image?<img src={r.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                  :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#3a3a3c",fontSize:12}}>?</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:"#f5f5f7"}} className="lc1">{r.titre}</p>
                <p style={{fontSize:11,color:"#636366",marginTop:1}}>{r.annee}</p>
              </div>
              <span style={{fontSize:11,color:accent,fontWeight:600,flexShrink:0}}>+ Ajouter</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SearchBar (dans les sections, gardé pour PartageSection) ── */
function SearchBar({type,onPick,placeholder}){
  const [q,setQ]=useState(""); const [res,setRes]=useState([]); const [loading,setL]=useState(false);
  const [focused,setFocused]=useState(false);
  const timer=useRef();
  const accent=C[type]?.accent||BLUE;

  useEffect(()=>{
    clearTimeout(timer.current);
    if(q.trim().length<2){setRes([]);return;}
    timer.current=setTimeout(async()=>{setL(true);const data=await searchMedia(type,q);setRes(data);setL(false);},400);
  },[q,type]);

  const pick=item=>{onPick(item);setQ("");setRes([]);};

  return(
    <div style={{position:"relative",maxWidth:600,margin:"0 auto"}}>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"#636366",fontSize:16,pointerEvents:"none"}}>🔍</span>
        <input value={q} onChange={e=>setQ(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),150)}
          placeholder={placeholder||"Rechercher…"}
          style={{width:"100%",background:"rgba(44,44,46,0.8)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:"14px 16px 14px 46px",color:"#f5f5f7",fontSize:16,outline:"none",transition:"border-color .2s",borderColor:focused?`${accent}80`:"rgba(255,255,255,0.1)"}}/>
        {loading&&<span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#636366",fontSize:13}}>…</span>}
      </div>
      {res.length>0&&focused&&(
        <div className="fade-in" style={{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,background:"rgba(28,28,30,0.98)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,overflow:"hidden",zIndex:50,boxShadow:"0 16px 40px rgba(0,0,0,.6)"}}>
          {res.map((r,i)=>(
            <div key={i} onMouseDown={()=>pick(r)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.05)"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:36,height:50,flexShrink:0,borderRadius:6,overflow:"hidden",background:"#2c2c2e"}}>
                {r.image?<img src={r.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                  :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#3a3a3c",fontSize:14}}>?</div>}
              </div>
              <div>
                <p style={{fontSize:15,fontWeight:600,color:"#f5f5f7"}}>{r.titre}</p>
                <p style={{fontSize:12,color:"#636366",marginTop:2}}>{r.annee}</p>
              </div>
              <span style={{marginLeft:"auto",fontSize:12,color:accent,fontWeight:600}}>+ Ajouter</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Card ── */
function Card({item,type,view,onEdit,onDelete,onToggleFavori,userEmail,partnerEmail}){
  const accent=C[type]?.accent||BLUE;
  const statut=item.statut||"";
  const sCol=statut===STATUTS[type]?.[0]?"#32D74B":statut===STATUTS[type]?.[1]?"#FFD60A":"#636366";
  const [hov,setHov]=useState(false);
  const [confirmDel,setConfirmDel]=useState(false);

  const handleDelete=e=>{
    e.stopPropagation();
    if(confirmDel){onDelete(item.id);}
    else{setConfirmDel(true);setTimeout(()=>setConfirmDel(false),2500);}
  };

  if(view==="list") return(
    <div className="card" style={{display:"flex",alignItems:"center",gap:12,padding:12,cursor:"pointer",position:"relative"}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setHov(false);setConfirmDel(false);}} onClick={()=>onEdit(item)}>
      <div style={{width:38,height:54,flexShrink:0,borderRadius:8,overflow:"hidden",background:"#2c2c2e"}}>
        {item.image?<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#3a3a3c",fontSize:14}}>?</div>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <p style={{fontSize:15,fontWeight:600}} className="lc1">{item.titre}</p>
          {item.favori&&<span style={{fontSize:13,flexShrink:0}}>❤️</span>}
          {(item.rewatches||[]).length>0&&<span style={{fontSize:10,color:"#636366",flexShrink:0}}>↩{item.rewatches.length}x</span>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
          <span className="tag" style={{background:C[type]?.light,color:accent}}>{item.genre}</span>
          {item.annee&&<span style={{fontSize:12,color:"#636366"}}>{item.annee}</span>}
          {statut&&<span style={{fontSize:11,color:sCol}}>● {statut}</span>}
        </div>
        {(item.note>0||item.note_partner>0)&&(
          <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
            {item.note>0&&<div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:10,color:"#8e8e93"}}>{userEmail?.split("@")[0]}</span><Stars value={item.note} size={11}/></div>}
            {item.note_partner>0&&<div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:10,color:"#8e8e93"}}>{PARTNER_EMAIL.split("@")[0]}</span><Stars value={item.note_partner} size={11}/></div>}
          </div>
        )}
      </div>
      {hov&&(
        <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button onClick={e=>{e.stopPropagation();onToggleFavori(item);}}
            style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:13}}>
            {item.favori?"❤️":"🤍"}
          </button>
          <button onClick={handleDelete}
            style={{background:confirmDel?"rgba(255,69,58,.25)":"rgba(255,69,58,.1)",border:confirmDel?"1px solid #FF453A":"none",borderRadius:8,color:"#FF453A",width:confirmDel?60:28,height:28,cursor:"pointer",fontSize:confirmDel?11:13,fontWeight:600,transition:"all .2s"}}>
            {confirmDel?"Sûr ?":"✕"}
          </button>
        </div>
      )}
    </div>
  );

  return(
    <div className="card" style={{overflow:"hidden",cursor:"pointer",position:"relative"}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setHov(false);setConfirmDel(false);}} onClick={()=>onEdit(item)}>
      <div style={{height:200,background:"#1c1c1e",position:"relative",overflow:"hidden"}}>
        {item.image?<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform .3s",transform:hov?"scale(1.04)":"scale(1)"}} onError={e=>e.target.style.display="none"}/>
          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#3a3a3c"}}>?</div>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 60%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 10px"}}>
          {statut&&<span style={{fontSize:10,color:sCol}}>● {statut}</span>}
        </div>
        {/* Favori */}
        <button onClick={e=>{e.stopPropagation();onToggleFavori(item);}}
          style={{position:"absolute",top:8,left:8,background:"rgba(0,0,0,.5)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:13,opacity:item.favori||hov?1:0,transition:"opacity .2s"}}>
          {item.favori?"❤️":"🤍"}
        </button>
        {/* Supprimer */}
        {hov&&(
          <button onClick={handleDelete}
            style={{position:"absolute",top:8,right:8,background:confirmDel?"rgba(255,69,58,.4)":"rgba(0,0,0,.6)",border:confirmDel?"1px solid #FF453A":"none",borderRadius:8,color:"#FF453A",width:confirmDel?50:28,height:28,cursor:"pointer",fontSize:confirmDel?10:13,fontWeight:600,transition:"all .2s"}}>
            {confirmDel?"Sûr ?":"✕"}
          </button>
        )}
        {/* Rewatch badge */}
        {(item.rewatches||[]).length>0&&(
          <span style={{position:"absolute",bottom:8,right:8,fontSize:10,color:"#FFD60A",background:"rgba(0,0,0,.6)",borderRadius:8,padding:"2px 6px"}}>↩{item.rewatches.length}x</span>
        )}
      </div>
      <div style={{padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
          <p style={{fontSize:13,fontWeight:600,flex:1}} className="lc1">{item.titre}</p>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span className="tag" style={{background:C[type]?.light,color:accent,fontSize:10}}>{item.genre}</span>
          {item.annee&&<span style={{fontSize:11,color:"#636366"}}>{item.annee}</span>}
        </div>
        {item.note>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <span style={{fontSize:9,color:"#636366",width:42,flexShrink:0}}>{userEmail?.split("@")[0]}</span>
              <Stars value={item.note} size={10}/>
            </div>
            {item.note_partner>0&&(
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#636366",width:42,flexShrink:0}}>{PARTNER_EMAIL.split("@")[0]}</span>
                <Stars value={item.note_partner} size={10}/>
              </div>
            )}
          </div>
        )}
        {item.tags?.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:5}}>
            {item.tags.slice(0,2).map(t=>(
              <span key={t} style={{fontSize:9,background:C[type]?.light,color:C[type]?.accent,borderRadius:10,padding:"2px 6px"}}>{t}</span>
            ))}
            {item.tags.length>2&&<span style={{fontSize:9,color:"#636366"}}>+{item.tags.length-2}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Import CSV ── */
function ImportCSV({onImport}){
  const ref=useRef();
  const handle=e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const lines=ev.target.result.split("\n");
      const hdrs=lines[0].split(",").map(h=>h.trim().replace(/"/g,"").toLowerCase());
      const items=[];
      for(let i=1;i<lines.length;i++){
        const cols=lines[i].split(",").map(c=>c.trim().replace(/"/g,""));
        const get=k=>{const idx=hdrs.indexOf(k);return idx>=0?cols[idx]:"";};
        const titre=get("name")||get("title");
        if(!titre) continue;
        items.push({titre,annee:get("year")||"",note:parseFloat(get("rating")||"0")||0,statut:"Vu",genre:"Action",type:"films"});
      }
      onImport(items); e.target.value="";
    };
    reader.readAsText(file);
  };
  return(
    <>
      <input type="file" accept=".csv" ref={ref} onChange={handle} style={{display:"none"}}/>
      <button onClick={()=>ref.current.click()} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"7px 14px",color:"#8e8e93",fontSize:12,cursor:"pointer"}}>
        ↑ Import Letterboxd
      </button>
    </>
  );
}

/* ── Media Section ── */
function Section({type,items,onSave,onDelete,userEmail,partnerEmail,pendingItem,onPendingConsumed}){
  const [modal,setModal]=useState(null);
  const [filter,setFilter]=useState("Tous");
  const [sort,setSort]=useState("date");
  const [view,setView]=useState("grid");
  const [saving,setSaving]=useState(false);
  const accent=C[type]?.accent||BLUE;

  // Quand l'utilisateur clique depuis la NavSearch
  useEffect(()=>{
    if(pendingItem){
      setModal({...pendingItem,genre:GENRES[type]?.[0],statut:STATUTS[type]?.[0],note:0,note_partner:0,critique:"",plateforme:""});
      onPendingConsumed();
    }
  },[pendingItem]);

  const handleSave=async item=>{
    setSaving(true);
    const isNew=!items.find(x=>x.id===item.id);
    await onSave({...item,type},isNew);
    setSaving(false); setModal(null);
  };

  const toggleFavori=async item=>{
    await onSave({...item,type,favori:!item.favori},false);
  };

  const statuts=["Tous",...(STATUTS[type]||[])];
  const filtered=[...items]
    .filter(i=>filter==="Tous"||i.statut===filter)
    .sort((a,b)=>{
      // Tri par statut par défaut : En cours > À faire > Terminé
      if(sort==="date"){
        const order=s=>{const st=STATUTS[type]||[];return s===st[1]?0:s===st[2]?1:2;};
        const od=order(a.statut)-order(b.statut);
        if(od!==0)return od;
        return new Date(b.dateAjout||0)-new Date(a.dateAjout||0);
      }
      if(sort==="note")return (b.note||0)-(a.note||0);
      if(sort==="titre")return a.titre.localeCompare(b.titre);
      if(sort==="annee")return (b.annee||"").localeCompare(a.annee||"");
      return 0;
    });

  return(
    <div className="fade-in">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:28,fontWeight:700,letterSpacing:-.5,color:accent}}>{type==="films"?"Films":type==="jeux"?"Jeux":"Livres"}</h2>
          <p style={{color:"#636366",fontSize:14,marginTop:4}}>{items.length} entrée{items.length!==1?"s":""}</p>
        </div>
        {type==="films"&&<ImportCSV onImport={async its=>{for(const i of its) await onSave({...i,id:Date.now()+Math.random()},true);}}/>}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {statuts.map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:"6px 16px",borderRadius:20,border:"none",background:filter===s?accent:"rgba(255,255,255,.08)",color:filter===s?"#fff":"#8e8e93",fontSize:13,cursor:"pointer",fontWeight:filter===s?600:400,transition:"all .2s"}}>
            {s}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            style={{background:"rgba(44,44,46,.8)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"6px 10px",color:"#8e8e93",fontSize:12,outline:"none"}}>
            <option value="date">Date</option>
            <option value="note">Note</option>
            <option value="titre">Titre</option>
            <option value="annee">Année</option>
          </select>
          <button onClick={()=>setView(v=>v==="grid"?"list":"grid")}
            style={{background:"rgba(44,44,46,.8)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"6px 12px",color:"#8e8e93",fontSize:15,cursor:"pointer"}}>
            {view==="grid"?"≡":"⊞"}
          </button>
        </div>
      </div>

      {filtered.length===0
        ?<div style={{textAlign:"center",padding:"80px 0",color:"#3a3a3c"}}>
            <p style={{fontSize:48,marginBottom:12}}>👀</p>
            <p style={{fontSize:16,color:"#636366"}}>Aucune entrée{filter!=="Tous"?` pour "${filter}"`:""}.</p>
            <p style={{fontSize:13,color:"#3a3a3c",marginTop:6}}>Utilisez la barre de recherche pour ajouter.</p>
          </div>
        :<div style={view==="grid"?{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:12}:{display:"flex",flexDirection:"column",gap:8}}>
                      {filtered.map(item=><Card key={item.id} item={item} type={type} view={view} onEdit={i=>setModal(i)} onDelete={onDelete} onToggleFavori={toggleFavori} userEmail={userEmail} partnerEmail={partnerEmail}/>)}
        </div>
      }

      {modal!==null&&<Modal item={Object.keys(modal).length?modal:null} type={type} onClose={()=>setModal(null)} onSave={handleSave} saving={saving} userEmail={userEmail} partnerEmail={partnerEmail}/>}
    </div>
  );
}

/* ── Découverte ── */
function Decouverte({data}){
  const [suggestions,setSuggestions]=useState({films:[],jeux:[],livres:[]});
  const [loading,setLoading]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [activeType,setActiveType]=useState("films");

  // Genres et titres déjà vus
  const topGenre=type=>{
    const items=data[type]||[];
    const gc={};
    items.forEach(i=>{if(i.genre)gc[i.genre]=(gc[i.genre]||0)+1;});
    return Object.entries(gc).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  };
  const titresVus=new Set([...(data.films||[]),...(data.jeux||[]),...(data.livres||[])].map(i=>i.titre.toLowerCase()));

  const load=async()=>{
    setLoading(true);
    try{
      const genreFilm=topGenre("films")||"Action";
      const genreJeu=topGenre("jeux")||"Action";
      const genreLivre=topGenre("livres")||"Roman";

      // Films via OMDB
      const rf=await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(genreFilm)}&type=movie&apikey=${OMDB}`);
      const jf=await rf.json();
      const films=(jf.Search||[]).map(m=>({titre:m.Title,annee:m.Year,image:m.Poster!=="N/A"?m.Poster:"",genre:genreFilm,type:"films"}))
        .filter(i=>!titresVus.has(i.titre.toLowerCase())).slice(0,8);

      // Jeux via RAWG
      const rj=await fetch(`https://api.rawg.io/api/games?genres=${genreJeu.toLowerCase()}&page_size=10&ordering=-rating&key=${RAWG}`);
      const jj=await rj.json();
      const jeux=((jj.results||[]).map(g=>({titre:g.name,annee:g.released?.slice(0,4)||"",image:g.background_image||"",genre:genreJeu,type:"jeux"})))
        .filter(i=>!titresVus.has(i.titre.toLowerCase())).slice(0,8);

      // Livres via OpenLibrary
      const rl=await fetch(`https://openlibrary.org/search.json?subject=${encodeURIComponent(genreLivre)}&limit=10&sort=rating`);
      const jl=await rl.json();
      const livres=((jl.docs||[]).map(b=>({titre:b.title,annee:b.first_publish_year?.toString()||"",image:b.cover_i?`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`:"",genre:genreLivre,type:"livres"})))
        .filter(i=>!titresVus.has(i.titre.toLowerCase())).slice(0,8);

      setSuggestions({films,jeux,livres});
      setLoaded(true);
    }catch(e){console.error(e);}
    setLoading(false);
  };

  const types=[{id:"films",label:"Films",icon:"🎬"},{id:"jeux",label:"Jeux",icon:"🎮"},{id:"livres",label:"Livres",icon:"📚"}];
  const current=suggestions[activeType]||[];
  const accent=C[activeType]?.accent||BLUE;
  const genreSuggéré=topGenre(activeType);

  return(
    <div className="fade-in">
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:28,fontWeight:700,letterSpacing:-.5}}>Découverte</h2>
        <p style={{color:"#636366",fontSize:14,marginTop:4}}>Suggestions basées sur vos goûts</p>
      </div>

      {!loaded?(
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:56,marginBottom:20}}>🎲</div>
          <p style={{fontSize:17,fontWeight:600,marginBottom:8}}>Prêt à découvrir ?</p>
          <p style={{fontSize:14,color:"#636366",marginBottom:28,maxWidth:340,margin:"0 auto 28px"}}>
            On analyse vos genres favoris et on vous trouve des suggestions que vous n'avez pas encore vus.
          </p>
          <button className="btn-primary" onClick={load} disabled={loading}
            style={{background:BLUE,color:"#fff",padding:"12px 32px",fontSize:16,opacity:loading?.6:1}}>
            {loading?"Analyse en cours…":"Générer des suggestions"}
          </button>
        </div>
      ):(
        <>
          {/* Onglets type */}
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
            {types.map(t=>(
              <button key={t.id} onClick={()=>setActiveType(t.id)}
                style={{padding:"8px 20px",borderRadius:20,border:"none",background:activeType===t.id?C[t.id].accent:"rgba(255,255,255,.08)",color:activeType===t.id?"#fff":"#8e8e93",fontSize:14,cursor:"pointer",fontWeight:activeType===t.id?600:400,transition:"all .2s"}}>
                {t.icon} {t.label}
              </button>
            ))}
            <button onClick={()=>{setLoaded(false);load();}} disabled={loading}
              style={{marginLeft:"auto",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"8px 16px",color:"#8e8e93",fontSize:13,cursor:"pointer"}}>
              {loading?"…":"↺ Relancer"}
            </button>
          </div>

          {genreSuggéré&&(
            <p style={{fontSize:13,color:"#636366",marginBottom:16}}>
              Basé sur votre genre favori : <span style={{color:accent,fontWeight:600}}>{genreSuggéré}</span>
            </p>
          )}

          {current.length===0?(
            <div style={{textAlign:"center",padding:"40px 0",color:"#636366"}}>
              <p style={{fontSize:15}}>Aucune suggestion disponible pour ce type.</p>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:12}}>
              {current.map((item,i)=>(
                <div key={i} className="card" style={{overflow:"hidden",position:"relative"}}>
                  {/* Badge "Nouveau" */}
                  <div style={{position:"absolute",top:8,left:8,zIndex:2}}>
                    <span style={{background:accent,color:"#fff",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,letterSpacing:.5}}>SUGGERÉ</span>
                  </div>
                  <div style={{height:200,background:"#1c1c1e",position:"relative",overflow:"hidden"}}>
                    {item.image
                      ?<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                      :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,color:"#3a3a3c"}}>?</div>}
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 60%)"}}/>
                  </div>
                  <div style={{padding:"10px 12px"}}>
                    <p style={{fontSize:13,fontWeight:600,marginBottom:4}} className="lc1">{item.titre}</p>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span className="tag" style={{background:C[activeType]?.light,color:accent,fontSize:10}}>{item.genre}</span>
                      {item.annee&&<span style={{fontSize:11,color:"#636366"}}>{item.annee}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Settings ── */
function Settings({onImport,userEmail}){
  const [ratings,setRatings]=useState(null);
  const [watched,setWatched]=useState(null);
  const [watchlist,setWatchlist]=useState(null);
  const [likes,setLikes]=useState(null);
  const [preview,setPreview]=useState([]);
  const [importing,setImporting]=useState(false);
  const [done,setDone]=useState(null);
  const [importProgress,setImportProgress]=useState(0);

  // Détecte automatiquement le type de CSV Letterboxd selon ses colonnes
  const detectCSVType=headers=>{
    const h=headers.join(",");
    if(h.includes("rating")) return "ratings";
    if(h.includes("letterboxd uri")&&!h.includes("rating")) return "watched_or_watchlist";
    return "unknown";
  };

  const parseCSV=text=>{
    const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return {rows:[],type:"unknown"};
    const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,"").toLowerCase());
    const csvType=detectCSVType(headers);
    const rows=lines.slice(1).map(line=>{
      const cols=[]; let cur="",inQ=false;
      for(let i=0;i<line.length;i++){
        const c=line[i];
        if(c==='"'){inQ=!inQ;}
        else if(c===','&&!inQ){cols.push(cur.trim());cur="";}
        else cur+=c;
      }
      cols.push(cur.trim());
      const obj={};
      headers.forEach((h,i)=>obj[h]=(cols[i]||"").replace(/^"|"$/g,"").trim());
      return obj;
    }).filter(r=>(r.name||r.title||"").trim().length>0);
    return {rows,type:csvType,headers};
  };

  const readFile=setter=>e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      const parsed=parseCSV(ev.target.result);
      setter(parsed);
    };
    r.readAsText(f,"UTF-8"); e.target.value="";
  };

  // Chargement intelligent : détecte automatiquement le type du CSV
  const readFileAuto=e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      const parsed=parseCSV(ev.target.result);
      const {type,rows}=parsed;
      if(type==="ratings") setRatings(parsed);
      else if(type==="watched_or_watchlist"){
        // Distingue watched vs watchlist selon le nom du fichier
        const fname=f.name.toLowerCase();
        if(fname.includes("watch")&&fname.includes("list")) setWatchlist(parsed);
        else setWatched(parsed);
      }
    };
    r.readAsText(f,"UTF-8"); e.target.value="";
  };

  const canPreview=(ratings&&ratings.rows.length>0)||(watched&&watched.rows.length>0)||(watchlist&&watchlist.rows.length>0);
  const totalRows=(ratings?.rows.length||0)+(watched?.rows.length||0)+(watchlist?.rows.length||0);

  const buildPreview=()=>{
    if(!canPreview) return;

    // Map notes par titre (depuis ratings.csv)
    const notesMap={};
    const ratingsDates={};
    (ratings?.rows||[]).forEach(r=>{
      const key=(r.name||r.title||"").toLowerCase();
      if(key){
        notesMap[key]=parseFloat(r.rating||"0")||0;
        if(r.date) ratingsDates[key]=r.date;
      }
    });

    // Set des likes (depuis likes/films.csv si chargé)
    const likesSet=new Set((likes?.rows||[]).map(r=>(r.name||r.title||"").toLowerCase()));

    const seen=new Set();
    const items=[];

    // Films vus avec note (ratings.csv)
    (ratings?.rows||[]).forEach(r=>{
      const titre=r.name||r.title||""; if(!titre)return;
      const key=titre.toLowerCase();
      if(seen.has(key))return; seen.add(key);
      const note=parseFloat(r.rating||"0")||0;
      const dateFin=r.date?new Date(r.date).toISOString():null;
      items.push({titre,annee:r.year||"",note,statut:"Vu",genre:"Action",type:"films",favori:likesSet.has(key),date_fin:dateFin,tags:[],rewatches:[]});
    });

    // Films vus sans note (watched.csv) — ajout seulement si pas déjà dans ratings
    (watched?.rows||[]).forEach(r=>{
      const titre=r.name||r.title||""; if(!titre)return;
      const key=titre.toLowerCase();
      if(seen.has(key))return; seen.add(key);
      // Récupère la note depuis ratings si dispo
      const note=notesMap[key]||0;
      const dateFin=r.date?new Date(r.date).toISOString():null;
      items.push({titre,annee:r.year||"",note,statut:"Vu",genre:"Action",type:"films",favori:likesSet.has(key),date_fin:dateFin,tags:[],rewatches:[]});
    });

    // Watchlist (films.csv) — statut "À voir"
    (watchlist?.rows||[]).forEach(r=>{
      const titre=r.name||r.title||""; if(!titre)return;
      const key=titre.toLowerCase();
      if(seen.has(key))return; seen.add(key);
      items.push({titre,annee:r.year||"",note:0,statut:"À voir",genre:"Action",type:"films",favori:false,date_fin:null,tags:[],rewatches:[]});
    });

    setPreview(items);
  };

  const doImport=async()=>{
    if(!preview.length)return;
    setImporting(true);
    setImportProgress(0);
    for(let i=0;i<preview.length;i++){
      await onImport({...preview[i],id:Date.now()+Math.random()},true);
      setImportProgress(i+1);
    }
    setDone(preview.length);
    setImporting(false);
    setPreview([]);
    setRatings(null); setWatched(null); setWatchlist(null); setLikes(null);
  };

  const FileZone=({label,sub,file,onRead,color,icon})=>{
    const ref=useRef();
    return(
      <div onClick={()=>ref.current.click()} style={{border:`2px dashed ${file?color:"rgba(255,255,255,.12)"}`,borderRadius:14,padding:"16px 18px",cursor:"pointer",transition:"all .2s",background:file?`${color}10`:"transparent",textAlign:"center"}}
        onMouseEnter={e=>!file&&(e.currentTarget.style.borderColor="rgba(255,255,255,.25)")}
        onMouseLeave={e=>!file&&(e.currentTarget.style.borderColor="rgba(255,255,255,.12)")}>
        <input type="file" accept=".csv" ref={ref} onChange={onRead} style={{display:"none"}}/>
        <div style={{fontSize:24,marginBottom:6}}>{file?"✅":icon||"📂"}</div>
        <p style={{fontWeight:600,fontSize:13,color:file?color:"#f5f5f7"}}>{label}</p>
        <p style={{fontSize:11,color:"#636366",marginTop:3}}>{file?`${file.rows.length} entrées`:sub}</p>
      </div>
    );
  };

  // Zone magique : détecte automatiquement le type
  const AutoDropZone=()=>{
    const ref=useRef();
    const [dragOver,setDragOver]=useState(false);
    const handleFiles=files=>{
      Array.from(files).forEach(f=>{
        const r=new FileReader();
        r.onload=ev=>{
          const parsed=parseCSV(ev.target.result);
          if(parsed.type==="ratings") setRatings(parsed);
          else if(parsed.type==="watched_or_watchlist"){
            const fname=f.name.toLowerCase();
            if(fname.includes("watch")&&(fname.includes("list")||fname.includes("list"))) setWatchlist(parsed);
            else setWatched(parsed);
          }
        };
        r.readAsText(f,"UTF-8");
      });
    };
    return(
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files);}}
        onClick={()=>ref.current.click()}
        style={{border:`2px dashed ${dragOver?"#0A84FF":"rgba(255,255,255,.15)"}`,borderRadius:14,padding:"24px",cursor:"pointer",transition:"all .2s",background:dragOver?"rgba(10,132,255,.07)":"rgba(255,255,255,.02)",textAlign:"center",marginBottom:16}}>
        <input type="file" accept=".csv" multiple ref={ref} onChange={e=>handleFiles(e.target.files)} style={{display:"none"}}/>
        <div style={{fontSize:32,marginBottom:8}}>📥</div>
        <p style={{fontWeight:600,fontSize:14,color:"#f5f5f7"}}>Glisser vos CSV ici</p>
        <p style={{fontSize:12,color:"#636366",marginTop:4}}>ou cliquer pour sélectionner — détection automatique du type</p>
        <p style={{fontSize:11,color:"#3a3a3c",marginTop:6}}>watched.csv · ratings.csv · films.csv · watchlist.csv</p>
      </div>
    );
  };

  return(
    <div className="fade-in" style={{maxWidth:640,margin:"0 auto"}}>
      <div style={{marginBottom:32}}>
        <h2 style={{fontSize:28,fontWeight:700,letterSpacing:-.5}}>Réglages</h2>
        <p style={{color:"#636366",fontSize:14,marginTop:4}}>Configuration et import de données</p>
      </div>

      {/* Import Letterboxd */}
      <div className="card" style={{padding:"24px 28px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,69,58,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎬</div>
          <div>
            <h3 style={{fontSize:16,fontWeight:700}}>Import Letterboxd</h3>
            <p style={{fontSize:12,color:"#636366",marginTop:2}}>Compatible avec tous les CSV exportés depuis Letterboxd</p>
          </div>
        </div>

        <div style={{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#8e8e93",lineHeight:1.7}}>
          Sur Letterboxd : <strong style={{color:"#f5f5f7"}}>Settings → Import &amp; Export → Export Your Data</strong><br/>
          Vous recevrez un ZIP. Glissez directement les CSV ci-dessous :<br/>
          <span style={{color:C.films.accent}}>ratings.csv</span> (films vus + notes) · <span style={{color:"#30D158"}}>watched.csv</span> (vus sans note) · <span style={{color:BLUE}}>films.csv</span> (watchlist) · <span style={{color:"#FF9F0A"}}>likes/films.csv</span> (coups de cœur)
        </div>

        {/* Zone drag & drop auto */}
        <AutoDropZone/>

        {/* Fichiers chargés */}
        {(ratings||watched||watchlist||likes)&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:16}}>
            {ratings&&<FileZone label="ratings.csv" sub="Notes & films vus" file={ratings} onRead={readFile(setRatings)} color={C.films.accent} icon="⭐"/>}
            {watched&&<FileZone label="watched.csv" sub="Films vus" file={watched} onRead={readFile(setWatched)} color="#30D158" icon="👁️"/>}
            {watchlist&&<FileZone label="films.csv" sub="Watchlist" file={watchlist} onRead={readFile(setWatchlist)} color={BLUE} icon="📋"/>}
            {likes&&<FileZone label="likes/films.csv" sub="Coups de cœur" file={likes} onRead={readFile(setLikes)} color="#FF9F0A" icon="❤️"/>}
          </div>
        )}

        {/* Résumé */}
        {canPreview&&!preview.length&&(
          <div style={{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#8e8e93",display:"flex",gap:16,flexWrap:"wrap"}}>
            {ratings&&<span style={{color:C.films.accent}}>⭐ {ratings.rows.length} films notés</span>}
            {watched&&<span style={{color:"#30D158"}}>👁 {watched.rows.length} films vus</span>}
            {watchlist&&<span style={{color:BLUE}}>📋 {watchlist.rows.length} en watchlist</span>}
            {likes&&<span style={{color:"#FF9F0A"}}>❤️ {likes.rows.length} coups de cœur</span>}
            <span style={{marginLeft:"auto",color:"#636366"}}>~{totalRows} entrées au total</span>
          </div>
        )}

        {canPreview&&!preview.length&&(
          <button className="btn-primary" onClick={buildPreview}
            style={{background:BLUE,color:"#fff",width:"100%",marginBottom:12}}>
            Prévisualiser l'import ({totalRows} entrées)
          </button>
        )}

        {preview.length>0&&(
          <>
            <div style={{background:"rgba(255,255,255,.04)",borderRadius:10,maxHeight:260,overflowY:"auto",marginBottom:14}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.06)",fontSize:11,color:"#8e8e93",display:"grid",gridTemplateColumns:"1fr 60px 60px 50px 30px",gap:8,position:"sticky",top:0,background:"rgba(28,28,30,.98)"}}>
                <span>TITRE</span><span>ANNÉE</span><span>STATUT</span><span>NOTE</span><span>❤</span>
              </div>
              {preview.slice(0,100).map((item,i)=>(
                <div key={i} style={{padding:"7px 14px",borderBottom:"1px solid rgba(255,255,255,.04)",fontSize:12,display:"grid",gridTemplateColumns:"1fr 60px 60px 50px 30px",gap:8,alignItems:"center"}}>
                  <span className="lc1" style={{color:"#f5f5f7"}}>{item.titre}</span>
                  <span style={{color:"#636366"}}>{item.annee}</span>
                  <span style={{fontSize:10,color:item.statut==="Vu"?C.films.accent:item.statut==="À voir"?BLUE:"#636366"}}>{item.statut}</span>
                  <span>{item.note>0?<Stars value={item.note} size={10}/>:<span style={{color:"#3a3a3c"}}>—</span>}</span>
                  <span>{item.favori?"❤️":""}</span>
                </div>
              ))}
              {preview.length>100&&<p style={{padding:"8px 14px",fontSize:12,color:"#636366"}}>…et {preview.length-100} autres</p>}
            </div>

            {importing&&(
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#636366",marginBottom:6}}>
                  <span>Import en cours…</span>
                  <span>{importProgress} / {preview.length}</span>
                </div>
                <div style={{height:4,background:"#2c2c2e",borderRadius:2}}>
                  <div style={{height:"100%",background:C.films.accent,borderRadius:2,width:`${(importProgress/preview.length)*100}%`,transition:"width .3s"}}/>
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setPreview([])}
                style={{flex:1,background:"rgba(255,255,255,.06)",border:"none",borderRadius:12,padding:"11px",color:"#8e8e93",cursor:"pointer",fontSize:14}}>
                Annuler
              </button>
              <button className="btn-primary" onClick={doImport} disabled={importing}
                style={{flex:2,background:C.films.accent,color:"#fff",opacity:importing?.6:1}}>
                {importing?`Import en cours… (${importProgress}/${preview.length})`:`Importer ${preview.length} films`}
              </button>
            </div>
          </>
        )}

        {done!==null&&(
          <div style={{textAlign:"center",padding:"16px 0",color:"#32D74B",fontSize:14,fontWeight:600}}>
            ✅ {done} films importés avec succès !
          </div>
        )}
      </div>

      {/* Infos compte */}
      <div className="card" style={{padding:"20px 24px"}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Compte</h3>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          <span style={{fontSize:14,color:"#8e8e93"}}>Email</span>
          <span style={{fontSize:14}}>{userEmail}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12}}>
          <span style={{fontSize:14,color:"#8e8e93"}}>Partenaire</span>
          <span style={{fontSize:14,color:C.partage.accent}}>{PARTNER_EMAIL}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Versus ── */
function Versus({feed, userEmail}){
  const me=feed.filter(i=>i._owner===userEmail);
  const her=feed.filter(i=>i._owner===PARTNER_EMAIL);
  const herName=PARTNER_EMAIL.split("@")[0];
  const myName=userEmail.split("@")[0];

  const avg=arr=>{const r=arr.filter(i=>i.note>0);return r.length?(r.reduce((s,i)=>s+i.note,0)/r.length):0;};
  const avgMe=avg(me), avgHer=avg(her);

  // Genres
  const genreMe={},genreHer={};
  me.forEach(i=>{if(i.genre)genreMe[i.genre]=(genreMe[i.genre]||0)+1;});
  her.forEach(i=>{if(i.genre)genreHer[i.genre]=(genreHer[i.genre]||0)+1;});
  const topGenreMe=Object.entries(genreMe).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g);
  const topGenreHer=Object.entries(genreHer).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g);

  // Titres en commun (même titre, les deux ont noté)
  const titresMe=new Map(me.filter(i=>i.note>0).map(i=>[i.titre.toLowerCase(),i]));
  const commun=her.filter(i=>i.note>0&&titresMe.has(i.titre.toLowerCase())).map(i=>({
    titre:i.titre, image:i.image||titresMe.get(i.titre.toLowerCase())?.image,
    noteMe:titresMe.get(i.titre.toLowerCase())?.note, noteHer:i.note,
    diff:Math.abs(titresMe.get(i.titre.toLowerCase())?.note - i.note),
    type:i.type
  })).sort((a,b)=>b.diff-a.diff);

  // Ce que l'un a vu mais pas l'autre
  const titresHerSet=new Set(her.map(i=>i.titre.toLowerCase()));
  const titresMeSet=new Set(me.map(i=>i.titre.toLowerCase()));
  const onlyMe=me.filter(i=>!titresHerSet.has(i.titre.toLowerCase())).slice(0,4);
  const onlyHer=her.filter(i=>!titresMeSet.has(i.titre.toLowerCase())).slice(0,4);

  const Bar=({valMe,valHer,labelMe,labelHer,accentMe,accentHer,title})=>{
    const total=valMe+valHer||1;
    return(
      <div style={{marginBottom:16}}>
        {title&&<p style={{fontSize:12,color:"#8e8e93",marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>{title}</p>}
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:15,fontWeight:700,color:accentMe}}>{labelMe}</span>
          <span style={{fontSize:15,fontWeight:700,color:accentHer}}>{labelHer}</span>
        </div>
        <div style={{display:"flex",height:6,borderRadius:6,overflow:"hidden",gap:2}}>
          <div style={{flex:valMe/total,background:accentMe,borderRadius:"6px 0 0 6px",transition:"flex .6s"}}/>
          <div style={{flex:valHer/total,background:accentHer,borderRadius:"0 6px 6px 0",transition:"flex .6s"}}/>
        </div>
      </div>
    );
  };

  return(
    <div className="fade-in" style={{maxWidth:740,margin:"0 auto"}}>
      {/* Header */}
      <div className="card" style={{padding:"24px 28px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          {/* Moi */}
          <div style={{textAlign:"center",flex:1}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#0A84FF,#BF5AF2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,margin:"0 auto 8px"}}>
              {myName.slice(0,2).toUpperCase()}
            </div>
            <p style={{fontWeight:700,fontSize:16}}>{myName}</p>
            <p style={{color:"#636366",fontSize:13,marginTop:2}}>{me.length} entrées</p>
          </div>
          {/* VS */}
          <div style={{textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:22,fontWeight:900,color:"#3a3a3c",letterSpacing:2}}>VS</div>
          </div>
          {/* Elle */}
          <div style={{textAlign:"center",flex:1}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#FF9F0A,#FF453A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,margin:"0 auto 8px"}}>
              {herName.slice(0,2).toUpperCase()}
            </div>
            <p style={{fontWeight:700,fontSize:16}}>{herName}</p>
            <p style={{color:"#636366",fontSize:13,marginTop:2}}>{her.length} entrées</p>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
        {/* Comparaison chiffres */}
        <div className="card" style={{padding:"16px 20px"}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Collection</h3>
          <Bar title="Total" valMe={me.length} valHer={her.length} labelMe={me.length} labelHer={her.length} accentMe={BLUE} accentHer="#FF9F0A"/>
          <Bar title="Films" valMe={me.filter(i=>i.type==="films").length} valHer={her.filter(i=>i.type==="films").length}
            labelMe={me.filter(i=>i.type==="films").length} labelHer={her.filter(i=>i.type==="films").length}
            accentMe={C.films.accent} accentHer={C.films.accent+"99"}/>
          <Bar title="Jeux" valMe={me.filter(i=>i.type==="jeux").length} valHer={her.filter(i=>i.type==="jeux").length}
            labelMe={me.filter(i=>i.type==="jeux").length} labelHer={her.filter(i=>i.type==="jeux").length}
            accentMe={C.jeux.accent} accentHer={C.jeux.accent+"99"}/>
          <Bar title="Livres" valMe={me.filter(i=>i.type==="livres").length} valHer={her.filter(i=>i.type==="livres").length}
            labelMe={me.filter(i=>i.type==="livres").length} labelHer={her.filter(i=>i.type==="livres").length}
            accentMe={C.livres.accent} accentHer={C.livres.accent+"99"}/>
        </div>

        {/* Notes moyennes */}
        <div className="card" style={{padding:"16px 20px"}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Notes moyennes</h3>
          <div style={{display:"flex",justifyContent:"space-around",marginBottom:16}}>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:36,fontWeight:700,color:BLUE}}>{avgMe>0?avgMe.toFixed(1):"—"}</p>
              <Stars value={avgMe} size={14}/>
              <p style={{fontSize:12,color:"#636366",marginTop:6}}>{myName}</p>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:36,fontWeight:700,color:"#FF9F0A"}}>{avgHer>0?avgHer.toFixed(1):"—"}</p>
              <Stars value={avgHer} size={14}/>
              <p style={{fontSize:12,color:"#636366",marginTop:6}}>{herName}</p>
            </div>
          </div>
          {avgMe>0&&avgHer>0&&(
            <p style={{textAlign:"center",fontSize:13,color:"#636366",borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:12}}>
              {avgMe>avgHer
                ?`${myName} note ${(avgMe-avgHer).toFixed(1)} pts plus haut en moyenne`
                :avgHer>avgMe
                ?`${herName} note ${(avgHer-avgMe).toFixed(1)} pts plus haut en moyenne`
                :"Vous notez exactement pareil 🎯"}
            </p>
          )}
        </div>

        {/* Genres favoris */}
        <div className="card" style={{padding:"16px 20px"}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>Genres favoris</h3>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <p style={{fontSize:11,color:BLUE,fontWeight:600,marginBottom:8}}>{myName}</p>
              {topGenreMe.map((g,i)=>(
                <div key={g} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:11,color:"#636366"}}>#{i+1}</span>
                  <span style={{fontSize:13,background:"rgba(10,132,255,.1)",color:BLUE,borderRadius:8,padding:"2px 8px"}}>{g}</span>
                </div>
              ))}
            </div>
            <div style={{width:1,background:"rgba(255,255,255,.06)"}}/>
            <div style={{flex:1}}>
              <p style={{fontSize:11,color:"#FF9F0A",fontWeight:600,marginBottom:8}}>{herName}</p>
              {topGenreHer.map((g,i)=>(
                <div key={g} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:11,color:"#636366"}}>#{i+1}</span>
                  <span style={{fontSize:13,background:"rgba(255,159,10,.1)",color:"#FF9F0A",borderRadius:8,padding:"2px 8px"}}>{g}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes divergentes */}
        {commun.length>0&&(
          <div className="card" style={{padding:"16px 20px"}}>
            <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>
              Notes divergentes
            </h3>
            <p style={{fontSize:12,color:"#636366",marginBottom:12}}>{commun.length} titre{commun.length>1?"s":"s"} en commun</p>
            {commun.slice(0,5).map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:10,borderBottom:i<Math.min(commun.length,5)-1?"1px solid rgba(255,255,255,.06)":"none"}}>
                <div style={{width:30,height:42,flexShrink:0,borderRadius:5,overflow:"hidden",background:"#2c2c2e"}}>
                  {item.image&&<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600}} className="lc1">{item.titre}</p>
                  <div style={{display:"flex",gap:12,marginTop:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:10,color:BLUE}}>{myName}</span>
                      <Stars value={item.noteMe} size={10}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:10,color:"#FF9F0A"}}>{herName}</span>
                      <Stars value={item.noteHer} size={10}/>
                    </div>
                  </div>
                </div>
                <span style={{fontSize:12,color:item.diff>=2?"#FF453A":item.diff>=1?"#FFD60A":"#32D74B",fontWeight:700,flexShrink:0}}>
                  {item.diff===0?"=":`±${item.diff}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Ce que l'un a vu mais pas l'autre */}
        {(onlyMe.length>0||onlyHer.length>0)&&(
          <div className="card" style={{padding:"16px 20px",gridColumn:"1 / -1"}}>
            <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>À faire découvrir</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {/* Moi mais pas elle */}
              <div>
                <p style={{fontSize:12,color:BLUE,fontWeight:600,marginBottom:10}}>{myName} a vu, pas {herName}</p>
                {onlyMe.map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:28,height:38,flexShrink:0,borderRadius:5,overflow:"hidden",background:"#2c2c2e"}}>
                      {item.image&&<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
                    </div>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:12,fontWeight:600}} className="lc1">{item.titre}</p>
                      {item.note>0&&<Stars value={item.note} size={10}/>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Elle mais pas moi */}
              <div>
                <p style={{fontSize:12,color:"#FF9F0A",fontWeight:600,marginBottom:10}}>{herName} a vu, pas {myName}</p>
                {onlyHer.map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{width:28,height:38,flexShrink:0,borderRadius:5,overflow:"hidden",background:"#2c2c2e"}}>
                      {item.image&&<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
                    </div>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:12,fontWeight:600}} className="lc1">{item.titre}</p>
                      {item.note>0&&<Stars value={item.note} size={10}/>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Profil ── */
function Profil({data, userEmail}){
  const films=data.films||[], jeux=data.jeux||[], livres=data.livres||[];
  const all=[...films.map(i=>({...i,_t:"films"})),...jeux.map(i=>({...i,_t:"jeux"})),...livres.map(i=>({...i,_t:"livres"}))];

  const avg=arr=>{const r=arr.filter(i=>i.note>0);return r.length?(r.reduce((s,i)=>s+i.note,0)/r.length).toFixed(1):"—";};
  const done=arr=>arr.filter(i=>i.statut===STATUTS[i._t||arr===films?"films":arr===jeux?"jeux":"livres"]?.[0]).length;

  // Top genres
  const genreCount={};
  all.forEach(i=>{if(i.genre)genreCount[i.genre]=(genreCount[i.genre]||0)+1;});
  const topGenres=Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Top tags
  const tagCount={};
  all.forEach(i=>(i.tags||[]).forEach(t=>{tagCount[t]=(tagCount[t]||0)+1;}));
  const topTags=Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Meilleures notes
  const topRated=[...all].filter(i=>i.note>0).sort((a,b)=>b.note-a.note).slice(0,5);

  // Initiales avatar
  const initials=userEmail?.split("@")[0]?.slice(0,2).toUpperCase()||"MC";

  const StatRow=({label,val,sub,accent})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
      <span style={{fontSize:14,color:"#8e8e93"}}>{label}</span>
      <div style={{textAlign:"right"}}>
        <span style={{fontSize:16,fontWeight:700,color:accent||"#f5f5f7"}}>{val}</span>
        {sub&&<span style={{fontSize:12,color:"#636366",marginLeft:8}}>{sub}</span>}
      </div>
    </div>
  );

  return(
    <div className="fade-in" style={{maxWidth:700,margin:"0 auto"}}>
      {/* Hero profil */}
      <div className="card" style={{padding:"28px 28px 24px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        {/* Bg affiches */}
        <div style={{position:"absolute",inset:0,display:"flex",gap:1,opacity:.08,overflow:"hidden"}}>
          {[...films,...jeux,...livres].filter(i=>i.image).slice(0,10).map((p,i)=>(
            <img key={i} src={p.image} style={{height:"100%",width:80,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
          ))}
        </div>
        <div style={{position:"relative",display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          {/* Avatar */}
          <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#0A84FF,#BF5AF2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,flexShrink:0}}>
            {initials}
          </div>
          <div style={{flex:1}}>
            <h2 style={{fontSize:22,fontWeight:700,letterSpacing:-.3}}>{userEmail?.split("@")[0]}</h2>
            <p style={{color:"#636366",fontSize:13,marginTop:3}}>{userEmail}</p>
            <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
              {[
                {label:"Films",val:films.length,c:C.films.accent},
                {label:"Jeux",val:jeux.length,c:C.jeux.accent},
                {label:"Livres",val:livres.length,c:C.livres.accent},
              ].map(s=>(
                <div key={s.label} style={{textAlign:"center"}}>
                  <p style={{fontSize:20,fontWeight:700,color:s.c}}>{s.val}</p>
                  <p style={{fontSize:11,color:"#636366"}}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {/* Stats détaillées */}
        <div className="card" style={{padding:"16px 20px"}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Stats</h3>
          <StatRow label="Films vus"    val={done(films)}  sub={`/ ${films.length}`}  accent={C.films.accent}/>
          <StatRow label="Jeux terminés" val={done(jeux)}  sub={`/ ${jeux.length}`}   accent={C.jeux.accent}/>
          <StatRow label="Livres lus"   val={done(livres)} sub={`/ ${livres.length}`} accent={C.livres.accent}/>
          <StatRow label="Note moy. films"  val={`★ ${avg(films)}`}  accent="#FFD60A"/>
          <StatRow label="Note moy. jeux"   val={`★ ${avg(jeux)}`}   accent="#FFD60A"/>
          <StatRow label="Note moy. livres" val={`★ ${avg(livres)}`} accent="#FFD60A"/>
          <StatRow label="Visionnage estimé" val={`${Math.floor(films.filter(i=>i.statut==="Vu").length*105/60)}h`} accent={BLUE}/>
        </div>

        {/* Top genres */}
        <div className="card" style={{padding:"16px 20px"}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Top Genres</h3>
          {topGenres.length===0?<p style={{color:"#636366",fontSize:13}}>Aucune donnée</p>
            :topGenres.map(([g,n],i)=>(
              <div key={g} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:12,color:"#636366",width:18,flexShrink:0}}>#{i+1}</span>
                <span style={{flex:1,fontSize:14}}>{g}</span>
                <div style={{width:80,height:3,background:"#2c2c2e",borderRadius:2}}>
                  <div style={{height:"100%",background:BLUE,borderRadius:2,width:`${(n/topGenres[0][1])*100}%`}}/>
                </div>
                <span style={{fontSize:12,color:"#636366",width:16,textAlign:"right"}}>{n}</span>
              </div>
            ))
          }
        </div>

        {/* Tags */}
        {topTags.length>0&&(
          <div className="card" style={{padding:"16px 20px"}}>
            <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Mes Tags</h3>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {topTags.map(([t,n])=>(
                <span key={t} style={{background:"rgba(10,132,255,.12)",color:BLUE,borderRadius:20,padding:"5px 12px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                  {t}
                  <span style={{background:"rgba(10,132,255,.2)",borderRadius:10,padding:"1px 5px",fontSize:10}}>{n}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meilleures notes */}
        {topRated.length>0&&(
          <div className="card" style={{padding:"16px 20px"}}>
            <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Vos coups de cœur</h3>
            {topRated.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:10,borderBottom:i<topRated.length-1?"1px solid rgba(255,255,255,.06)":"none"}}>
                <div style={{width:32,height:44,flexShrink:0,borderRadius:6,overflow:"hidden",background:"#2c2c2e"}}>
                  {item.image&&<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600}} className="lc1">{item.titre}</p>
                  <span className="tag" style={{background:C[item._t]?.light,color:C[item._t]?.accent,fontSize:10,marginTop:3,display:"inline-block"}}>{C[item._t]?.label}</span>
                </div>
                <Stars value={item.note} size={12}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Partage / Fil d'activité ── */
function Partage({feed, userEmail}){
  if(feed.length===0) return(
    <div className="fade-in">
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:28,fontWeight:700,letterSpacing:-.5,color:C.partage.accent}}>Activité</h2>
        <p style={{color:"#636366",fontSize:14,marginTop:4}}>Ce que vous et {PARTNER_EMAIL.split("@")[0]} avez ajouté</p>
      </div>
      <div style={{textAlign:"center",padding:"80px 0"}}>
        <p style={{fontSize:48,marginBottom:12}}>👀</p>
        <p style={{fontSize:16,color:"#636366"}}>Aucune activité pour l'instant.</p>
        <p style={{fontSize:13,color:"#3a3a3c",marginTop:6}}>Ajoutez des films, jeux ou livres pour les voir apparaître ici.</p>
      </div>
    </div>
  );

  // Grouper par jour
  const groups={};
  feed.forEach(item=>{
    const day=item.date_ajout?new Date(item.date_ajout).toDateString():"Inconnu";
    if(!groups[day]) groups[day]=[];
    groups[day].push(item);
  });

  return(
    <div className="fade-in">
      <div style={{marginBottom:28}}>
        <h2 style={{fontSize:28,fontWeight:700,letterSpacing:-.5,color:C.partage.accent}}>Activité</h2>
        <p style={{color:"#636366",fontSize:14,marginTop:4}}>Ce que vous et {PARTNER_EMAIL.split("@")[0]} avez ajouté</p>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",display:"flex",flexDirection:"column",gap:28}}>
        {Object.entries(groups).map(([day,items])=>(
          <div key={day}>
            <p style={{fontSize:12,color:"#636366",textTransform:"uppercase",letterSpacing:1,marginBottom:12,fontWeight:600}}>
              {timeAgo(items[0].date_ajout)==="hier"?"Hier":new Date(day).toLocaleDateString("fr",{weekday:"long",day:"numeric",month:"long"})}
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {items.map((item,i)=>{
                const isMe=item._owner===userEmail;
                const accent=C[item.type]?.accent||BLUE;
                const typeLabel=item.type==="films"?"Film":item.type==="jeux"?"Jeu":"Livre";
                const statutDone=item.statut===STATUTS[item.type]?.[0];
                return(
                  <div key={i} className="card" style={{display:"flex",gap:14,padding:14,alignItems:"flex-start"}}>
                    {/* Affiche */}
                    <div style={{width:46,height:64,flexShrink:0,borderRadius:8,overflow:"hidden",background:"#2c2c2e"}}>
                      {item.image?<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                        :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#3a3a3c",fontSize:18}}>?</div>}
                    </div>
                    {/* Infos */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:700,color:isMe?"#f5f5f7":C.partage.accent}}>
                          {isMe?"Vous":PARTNER_EMAIL.split("@")[0]}
                        </span>
                        <span style={{fontSize:12,color:"#636366"}}>
                          {statutDone?"a terminé":"a ajouté"}
                        </span>
                        <span className="tag" style={{background:C[item.type]?.light,color:accent,fontSize:10}}>{typeLabel}</span>
                        <span style={{fontSize:11,color:"#3a3a3c",marginLeft:"auto"}}>{timeAgo(item.date_ajout)}</span>
                      </div>
                      <p style={{fontSize:15,fontWeight:600,color:"#f5f5f7",marginBottom:4}} className="lc1">{item.titre}</p>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        {item.genre&&<span style={{fontSize:12,color:"#636366"}}>{item.genre}</span>}
                        {item.annee&&<span style={{fontSize:12,color:"#636366"}}>· {item.annee}</span>}
                        {item.note>0&&<Stars value={item.note} size={12}/>}
                      </div>
                      {item.critique&&<p style={{fontSize:12,color:"#8e8e93",marginTop:6,fontStyle:"italic"}} className="lc2">"{item.critique}"</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Dashboard ── */
function Dashboard({data,shared,userEmail}){
  const films=data.films||[],jeux=data.jeux||[],livres=data.livres||[];
  const all=[...films.map(i=>({...i,_t:"films"})),...jeux.map(i=>({...i,_t:"jeux"})),...livres.map(i=>({...i,_t:"livres"}))];

  // Affiches pour le hero
  const posters=[...all].filter(i=>i.image).sort(()=>Math.random()-.5).slice(0,12);  const avg=arr=>{const r=arr.filter(i=>i.note>0);return r.length?(r.reduce((s,i)=>s+i.note,0)/r.length).toFixed(1):"—";};
  const totalH=Math.floor(films.filter(i=>i.statut==="Vu").length*105/60);
  const streak=(()=>{
    const dates=all.filter(i=>i.dateAjout).map(i=>i.dateAjout.slice(0,7)).sort().reverse();
    if(!dates.length)return 0;
    let s=1,cur=dates[0];
    for(let i=1;i<dates.length;i++){if(dates[i]===cur)continue;const d=new Date(cur+"-01"),p=new Date(dates[i]+"-01");if((d-p)/(1000*60*60*24*28)<=1.5){s++;cur=dates[i];}else break;}
    return s;
  })();
  const now=new Date();
  const months=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);return{label:d.toLocaleString("fr",{month:"short"}),key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};});
  const byMonth={};all.forEach(i=>{if(!i.dateAjout)return;const k=i.dateAjout.slice(0,7);byMonth[k]=(byMonth[k]||0)+1;});
  const maxM=Math.max(1,...months.map(m=>byMonth[m.key]||0));
  const genreCount={};all.forEach(i=>{if(i.genre)genreCount[i.genre]=(genreCount[i.genre]||0)+1;});
  const topG=Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const recent=[...all].filter(i=>i.dateAjout).sort((a,b)=>new Date(b.dateAjout)-new Date(a.dateAjout)).slice(0,6);

  const Stat=({val,label,sub,color})=>(
    <div className="card" style={{padding:"18px 20px"}}>
      <p style={{fontSize:30,fontWeight:700,color:color||"#f5f5f7",letterSpacing:-1}}>{val}</p>
      <p style={{fontSize:13,fontWeight:600,color:"#f5f5f7",marginTop:4}}>{label}</p>
      {sub&&<p style={{fontSize:12,color:"#636366",marginTop:2}}>{sub}</p>}
    </div>
  );

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:28}}>
      {/* Hero avec affiches */}
      <div style={{position:"relative",borderRadius:20,overflow:"hidden",minHeight:180,background:"#111"}}>
        {/* Mosaïque d'affiches floutées */}
        {posters.length>0&&(
          <div style={{position:"absolute",inset:0,display:"flex",gap:2,overflow:"hidden",opacity:.35}}>
            {posters.map((p,i)=>(
              <img key={i} src={p.image} style={{height:"100%",width:100,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>
            ))}
          </div>
        )}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.5) 100%)",backdropFilter:posters.length?"blur(8px)":"none"}}/>
        <div style={{position:"relative",padding:"28px 32px"}}>
          <h2 style={{fontSize:26,fontWeight:700,letterSpacing:-.5,marginBottom:6}}>
            Bonjour, {userEmail?.split("@")[0]} 👋
          </h2>
          <p style={{color:"#8e8e93",fontSize:15}}>{all.length} entrée{all.length!==1?"s":""} dans votre collection</p>
          <div style={{display:"flex",gap:20,marginTop:16,flexWrap:"wrap"}}>
            {[{label:"Films",val:films.length,c:C.films.accent},{label:"Jeux",val:jeux.length,c:C.jeux.accent},{label:"Livres",val:livres.length,c:C.livres.accent}].map(s=>(
              <div key={s.label}>
                <span style={{fontSize:22,fontWeight:700,color:s.c}}>{s.val}</span>
                <span style={{fontSize:13,color:"#636366",marginLeft:6}}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
        <Stat val={films.length}  label="Films"  sub={`★ ${avg(films)}`}  color={C.films.accent}/>
        <Stat val={jeux.length}   label="Jeux"   sub={`★ ${avg(jeux)}`}   color={C.jeux.accent}/>
        <Stat val={livres.length} label="Livres" sub={`★ ${avg(livres)}`} color={C.livres.accent}/>
        <Stat val={`${totalH}h`}  label="Visionnage" sub={`${films.filter(i=>i.statut==="Vu").length} films vus`} color={BLUE}/>
        <Stat val={streak}        label="Streak"     sub="mois consécutifs" color="#FFD60A"/>
        <Stat val={shared.length} label="À deux"     sub="à voir ensemble"  color={C.partage.accent}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>
        {/* Top genres */}
        <div className="card" style={{padding:20}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Top Genres</h3>
          {topG.length===0?<p style={{color:"#636366",fontSize:14}}>Aucune donnée</p>
            :topG.map(([g,n])=>(
              <div key={g} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:14}}>{g}</span>
                  <span style={{fontSize:13,color:"#636366"}}>{n}</span>
                </div>
                <div style={{height:3,background:"#2c2c2e",borderRadius:2}}>
                  <div style={{height:"100%",background:BLUE,borderRadius:2,width:`${(n/topG[0][1])*100}%`,transition:"width .6s"}}/>
                </div>
              </div>
            ))}
        </div>

        {/* Graphe mensuel */}
        <div className="card" style={{padding:20}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Activité (6 mois)</h3>
          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:80}}>
            {months.map(m=>{
              const v=byMonth[m.key]||0,h=maxM?(v/maxM)*100:0;
              return(
                <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  {v>0&&<span style={{fontSize:10,color:"#8e8e93"}}>{v}</span>}
                  <div style={{width:"100%",background:"#2c2c2e",borderRadius:4,height:60,display:"flex",alignItems:"flex-end",overflow:"hidden"}}>
                    <div style={{width:"100%",background:BLUE,borderRadius:4,height:`${h}%`,transition:"height .6s"}}/>
                  </div>
                  <span style={{fontSize:10,color:"#636366"}}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activité récente */}
        <div className="card" style={{padding:20}}>
          <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Récemment ajouté</h3>
          {recent.length===0?<p style={{color:"#636366",fontSize:14}}>Aucune activité</p>
            :recent.map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,paddingBottom:10,borderBottom:i<recent.length-1?"1px solid rgba(255,255,255,.06)":"none"}}>
                <div style={{width:28,height:40,flexShrink:0,borderRadius:5,overflow:"hidden",background:"#2c2c2e"}}>
                  {item.image&&<img src={item.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600}} className="lc1">{item.titre}</p>
                  <p style={{fontSize:11,color:"#636366",marginTop:2}}>{item._t==="films"?"Film":item._t==="jeux"?"Jeu":"Livre"} · {item.dateAjout?.slice(0,10)}</p>
                </div>
                {item.note>0&&<Stars value={item.note} size={10}/>}
              </div>
            ))}
        </div>

        {/* Statuts */}
        {["films","jeux","livres"].map(type=>{
          const its=data[type]||[];if(!its.length)return null;
          const accent=C[type].accent;
          return(
            <div key={type} className="card" style={{padding:20}}>
              <h3 style={{fontSize:13,fontWeight:600,color:"#8e8e93",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>
                {type==="films"?"Films":type==="jeux"?"Jeux":"Livres"}
              </h3>
              {STATUTS[type].map(s=>{
                const n=its.filter(i=>i.statut===s).length;
                return(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontSize:13,color:"#8e8e93",width:80,flexShrink:0}}>{s}</span>
                    <div style={{flex:1,height:3,background:"#2c2c2e",borderRadius:2}}>
                      <div style={{height:"100%",background:accent,borderRadius:2,width:its.length?`${(n/its.length)*100}%`:"0%",transition:"width .6s"}}/>
                    </div>
                    <span style={{fontSize:12,color:"#636366",width:16,textAlign:"right"}}>{n}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── App ── */
function App(){
  const [tab,setTab]=useState("dashboard");
  const [session,setSession]=useState(null);
  const [data,setData]=useState({films:[],jeux:[],livres:[]});
  const [shared,setShared]=useState([]);
  const [loading,setLoading]=useState(true);
  const [partnerEmail]=useState("");
  // Pending item depuis NavSearch → transmis à la section active
  const [pending,setPending]=useState(null); // {item, type}

  const [feed,setFeed]=useState([]);

  useEffect(()=>{
    (async()=>{
      const token=localStorage.getItem("mc_token");
      if(token){const user=await authAPI.getUser(token);if(user?.id){setSession({token,user});return;}localStorage.removeItem("mc_token");}
      setLoading(false);
    })();
  },[]);

  const loadAll=useCallback(async(token,userEmail)=>{
    setLoading(true);
    try{
      const rows=await db.getAll(token);
      const g={films:[],jeux:[],livres:[]};
      rows.forEach(r=>{if(g[r.type])g[r.type].push({...r,dateAjout:r.date_ajout});});
      setData(g);
      // Feed : toutes les entrées triées par date, avec owner
      const allRows=[...rows].map(r=>({...r,_owner:r.user_id===session?.user?.id?userEmail:PARTNER_EMAIL}))
        .sort((a,b)=>new Date(b.date_ajout||0)-new Date(a.date_ajout||0));
      setFeed(allRows);
      setShared(await db.getShared(token));
    }catch(e){console.error(e);}
    setLoading(false);
  },[session]);

  useEffect(()=>{if(session)loadAll(session.token,session.user.email);},[session]);

  const saveItem=useCallback(async(item,isNew)=>{
    const isDone = item.statut===STATUTS[item.type]?.[0];
    const p={id:item.id,type:item.type,titre:item.titre,genre:item.genre||"",statut:item.statut||"",note:isDone?(item.note||0):0,note_partner:item.note_partner||0,critique:isDone?(item.critique||""):"",annee:item.annee||"",image:item.image||"",plateforme:item.plateforme||"",tags:item.tags||[],favori:item.favori||false,rewatches:item.rewatches||[],date_ajout:item.dateAjout||new Date().toISOString(),date_fin:isDone?(item.date_fin||new Date().toISOString()):null,user_id:session.user.id,partner_email:PARTNER_EMAIL};
    if(isNew)await db.insert(session.token,p);else await db.update(session.token,p);
    await loadAll(session.token,session.user.email);
  },[session,loadAll]);

  const deleteItem=useCallback(async id=>{await db.delete(session.token,id);await loadAll(session.token,session.user.email);},[session,loadAll]);
  const addShared=useCallback(async item=>{await db.addShared(session.token,{...item,ajoute_par:session.user.id});await loadAll(session.token,session.user.email);},[session,loadAll]);
  const delShared=useCallback(async id=>{await db.delShared(session.token,id);await loadAll(session.token,session.user.email);},[session,loadAll]);
  const logout=async()=>{await authAPI.signOut(session.token);localStorage.removeItem("mc_token");setSession(null);};

  // NavSearch → bascule vers le bon onglet + ouvre la modal
  const handleNavPick=(item,type)=>{
    if(["films","jeux","livres"].includes(type)){
      setTab(type);
      setPending({item,type});
    }
  };

  if(!session) return <Login onLogin={(t,u)=>setSession({token:t,user:u})}/>;
  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#0A84FF,#BF5AF2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🎬</div>
      <p style={{color:"#636366",fontSize:14}}>Chargement…</p>
    </div>
  );

  return(
    <div style={{minHeight:"100vh"}}>
      {/* Nav */}
      <nav className="glass" style={{position:"sticky",top:0,zIndex:40,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 20px",height:52,display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0A84FF,#BF5AF2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:12,flexShrink:0}}>🎬</div>
          <span style={{fontWeight:700,fontSize:16,letterSpacing:-.3,marginRight:16,flexShrink:0}}>MyCulture</span>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{background:"none",border:"none",color:tab===t.id?"#f5f5f7":"#636366",fontSize:14,cursor:"pointer",padding:"6px 12px",borderRadius:8,fontWeight:tab===t.id?600:400,transition:"color .15s",whiteSpace:"nowrap"}}>
              {t.label}
            </button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            <NavSearch activeTab={tab} onPick={handleNavPick}/>
            <button onClick={logout} style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:8,padding:"6px 12px",color:"#8e8e93",fontSize:12,cursor:"pointer",flexShrink:0}}>
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main style={{maxWidth:1100,margin:"0 auto",padding:"32px 20px"}}>
        {tab==="dashboard"&&<Dashboard data={data} shared={shared} userEmail={session.user.email}/>}
        {tab==="films"    &&<Section type="films"  items={data.films||[]}  onSave={saveItem} onDelete={deleteItem} userEmail={session.user.email} partnerEmail={partnerEmail} pendingItem={pending?.type==="films"?pending.item:null} onPendingConsumed={()=>setPending(null)}/>}
        {tab==="jeux"     &&<Section type="jeux"   items={data.jeux||[]}   onSave={saveItem} onDelete={deleteItem} userEmail={session.user.email} partnerEmail={partnerEmail} pendingItem={pending?.type==="jeux"?pending.item:null}  onPendingConsumed={()=>setPending(null)}/>}
        {tab==="livres"   &&<Section type="livres" items={data.livres||[]} onSave={saveItem} onDelete={deleteItem} userEmail={session.user.email} partnerEmail={partnerEmail} pendingItem={pending?.type==="livres"?pending.item:null} onPendingConsumed={()=>setPending(null)}/>}
        {tab==="settings" &&<Settings onImport={saveItem} userEmail={session.user.email}/>}
        {tab==="decouverte"&&<Decouverte data={data}/>}
        {tab==="versus"   &&<Versus feed={feed} userEmail={session.user.email}/>}
        {tab==="partage"  &&<Partage feed={feed} userEmail={session.user.email}/>}
        {tab==="profil"   &&<Profil data={data} userEmail={session.user.email}/>}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
