// ═══════════════════════════════════════════════════════════════
// ST NEGATION TOOL — Frontend App (Web Version)
// "Connect Amazon Account" → OAuth → Pull → Negate
// ═══════════════════════════════════════════════════════════════

const S={step:"loading",profiles:[],selectedProfile:null,data:[],info:null,err:null,loading:false,loadingMsg:"",
  pullDays:30,th:{minClicks:10,maxSpend:10,maxAcos:45,zeroOnly:true},negLevel:"adgroup",negMatch:"exact",
  sel:new Set(),sort:"spend",dir:"desc",filter:"negate",search:"",cls:[],applyResult:null,
  savedProfiles:[],activeProfile:null};
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const f$=v=>v==null?"—":"$"+v.toFixed(2);
const fP=v=>!v?"—":(v*100).toFixed(1)+"%";
const fN=v=>v==null?"—":v.toLocaleString();

// ─── Init: check auth status ───
async function init(){
  try{
    const r=await fetch("/auth/status").then(r=>r.json());
    if(r.connected){S.profiles=r.profiles||[];S.step="accounts";
      const sr=await fetch("/api/settings").then(r=>r.json());
      if(sr.th)Object.assign(S.th,sr.th);if(sr.negLevel)S.negLevel=sr.negLevel;if(sr.negMatch)S.negMatch=sr.negMatch;
      const sp=await fetch("/api/profiles/saved").then(r=>r.json());
      if(Array.isArray(sp))S.savedProfiles=sp;
    }else{S.step="connect";}
  }catch(e){S.step="connect";}
  R();
}

// ─── Classification ───
function classify(t){
  const mc=S.th.minClicks,ms=S.th.maxSpend,ma=S.th.maxAcos/100;
  if(t.orders===0&&t.clicks>=mc)return"negate";
  if(t.orders===0&&t.spend>=ms)return"negate";
  if(!S.th.zeroOnly&&t.orders>0&&t.acos>0&&t.acos>ma&&t.spend>=ms)return"negate";
  if(t.orders===0&&(t.clicks>=mc*.6||t.spend>=ms*.6))return"warning";
  if(t.orders>0&&t.acos>0&&t.acos>ma*.85)return"warning";
  return"safe";
}
function reCls(){S.cls=S.data.map(t=>({...t,st:classify(t)}));}

// ─── Render dispatcher ───
function R(){
  const m={loading:rLoading,connect:rConnect,accounts:rAccounts,pull:rPull,thresholds:rThresholds,review:rReview,apply:rApply,profiles:rProfiles};
  document.getElementById("app").innerHTML=(m[S.step]||rConnect)();
  bindAll();
}

function hdr(sub){
  const p=S.selectedProfile;
  return'<div class="hdr"><div class="logo"><div class="logo-i">⛔</div><div><h1>ST Negation Tool</h1>'+
    '<p>AMAZON ADS API'+(p?" • "+esc(p.accountName)+" ("+p.countryCode+")":"")+(S.data.length?" • "+fN(S.data.length)+" terms":"")+'</p></div></div>'+
    '<div class="flex gap8">'+
    (S.step!=="connect"&&S.step!=="loading"?'<button class="btn btn-s btn-sm" onclick="S.step=\'profiles\';S.activeProfile=null;R()">👤 Profiles</button>'+
    '<button class="btn btn-s btn-sm" onclick="if(confirm(\'Disconnect?\'))fetch(\'/auth/disconnect\',{method:\'POST\'}).then(()=>{S.step=\'connect\';S.profiles=[];R()})">🔌 Disconnect</button>':"")+
    '</div></div>';
}
function loaderOvl(){return S.loading?'<div class="loading-overlay"><div class="loading-box"><div class="spinner"></div><div style="font-size:15px;font-weight:700;color:var(--w);margin-top:16px" id="loadMsg">'+esc(S.loadingMsg)+'</div><div style="font-size:11px;color:var(--t4);margin-top:6px">This may take 30-60 seconds...</div></div></div>':"";}

// ═══ SCREENS ═══
function rLoading(){return'<div class="body"><div class="scroll"><div class="center tc" style="padding-top:80px"><div class="spinner" style="margin:0 auto 16px"></div><div style="color:var(--t3)">Checking connection...</div></div></div></div>';}

function rConnect(){
  const urlErr=new URLSearchParams(window.location.search).get("error");
  const errMsg=urlErr?'<div class="err" style="margin-top:16px">Connection failed: '+esc(new URLSearchParams(window.location.search).get("msg")||urlErr)+'</div>':"";
  return hdr()+
    '<div class="body"><div class="scroll"><div class="center tc" style="padding-top:40px">'+
    '<div style="font-size:48px;margin-bottom:20px">⛔</div>'+
    '<div style="font-size:28px;font-weight:900;color:var(--w);margin-bottom:10px">Search Term Negation Tool</div>'+
    '<div style="font-size:13px;color:var(--t3);margin-bottom:36px;line-height:1.6">Connect your Amazon Advertising account to pull search terms,<br>identify wasteful spend, and auto-negate — all in one click.</div>'+
    '<a href="/auth/amazon" class="btn btn-amazon" style="text-decoration:none;display:inline-block">🔗 Connect Amazon Account</a>'+
    '<div style="font-size:10px;color:var(--t5);margin-top:16px;line-height:1.6">Uses official Amazon Advertising API with OAuth2.<br>Your credentials are stored securely in your session — never shared.</div>'+
    errMsg+
    '<div class="card mt24 tl" style="max-width:500px;margin:24px auto 0"><h3 style="font-size:13px">How it works</h3>'+
    '<div style="font-size:11px;color:var(--t2);line-height:2;margin-top:8px">'+
    '<b style="color:var(--o)">1.</b> Click <b>Connect Amazon Account</b> above<br>'+
    '<b style="color:var(--o)">2.</b> Log in to your Amazon account & click "Allow"<br>'+
    '<b style="color:var(--o)">3.</b> Select an account & date range<br>'+
    '<b style="color:var(--o)">4.</b> Set negation thresholds<br>'+
    '<b style="color:var(--o)">5.</b> Review & auto-apply negative keywords</div></div>'+
    '</div></div></div>';
}

function rAccounts(){
  const cards=S.profiles.length?S.profiles.map((p,i)=>
    '<div class="acct-card" data-ai="'+i+'"><div class="flex" style="justify-content:space-between">'+
    '<div><b style="font-size:14px;color:var(--w)">'+esc(p.accountName)+'</b>'+
    '<div style="font-size:10px;color:var(--t4)">'+esc(p.countryCode)+' • '+esc(p.accountType)+' • '+esc(p.currencyCode)+'</div></div>'+
    '<div style="font-size:22px;color:var(--bl)">→</div></div></div>'
  ).join(""):'<div class="tc" style="padding:32px;color:var(--t4)">No advertising profiles found.</div>';
  return hdr()+loaderOvl()+
    '<div class="body"><div class="scroll"><div class="center">'+
    '<div style="font-size:22px;font-weight:900;color:var(--w);margin-bottom:6px">Select Account</div>'+
    '<div style="font-size:11px;color:var(--t3);margin-bottom:20px">'+S.profiles.length+' accounts connected. Choose one to pull search terms.</div>'+
    cards+'<button class="btn btn-s mt16" onclick="refreshProfiles()">🔄 Refresh Accounts</button>'+
    '</div></div></div>';
}

function rPull(){
  const p=S.selectedProfile;
  const dayBtns=[7,14,30,65].map(d=>'<button class="day-btn'+(S.pullDays===d?" on":"")+'" data-days="'+d+'">'+d+' days</button>').join("");
  return hdr()+loaderOvl()+
    '<div class="body"><div class="scroll"><div class="center">'+
    '<div class="tc" style="margin-bottom:24px"><div style="font-size:24px;font-weight:900;color:var(--w);margin-bottom:6px">Pull Search Terms</div>'+
    '<div style="font-size:12px;color:var(--t3)">Account: <b style="color:var(--bl)">'+esc(p?p.accountName:"—")+'</b> ('+esc(p?p.countryCode:"—")+')</div></div>'+
    '<div class="card pull-card"><div class="flex gap12" style="margin-bottom:14px"><div style="font-size:28px">⚡</div><div>'+
    '<h3 style="color:var(--bl)">Search Term Report</h3>'+
    '<div class="desc" style="margin:0">Pulled via official Amazon Advertising API.</div></div></div>'+
    '<span class="lbl">DATE RANGE</span><div class="day-btns">'+dayBtns+'</div>'+
    '<button class="btn btn-bl" id="btnPull" style="width:100%;padding:14px;font-size:14px">⚡ Pull Search Terms ('+S.pullDays+' days)</button>'+
    (S.err?'<div class="err">'+esc(S.err)+'</div>':"")+
    '</div>'+
    '<button class="btn btn-s mt16" onclick="S.step=\'accounts\';S.err=null;R()">← Switch Account</button>'+
    '</div></div></div>';
}

function rThresholds(){
  reCls();const neg=S.cls.filter(t=>t.st==="negate"),wrn=S.cls.filter(t=>t.st==="warning"),waste=neg.reduce((s,t)=>s+t.spend,0),pi=S.info,th=S.th;
  return hdr()+
    '<div class="body"><div class="scroll"><div class="wide">'+
    '<div class="stats">'+[["SEARCH TERMS",fN(pi.total),"--w"],["CAMPAIGNS",pi.camps,"--bl"],["AD GROUPS",pi.ags,"--p"],["TOTAL SPEND",f$(pi.spend),"--o"],["TOTAL SALES",f$(pi.sales),"--g"]].map(x=>'<div class="stat"><b style="color:var('+x[2]+')">'+x[1]+'</b><small>'+x[0]+'</small></div>').join("")+'</div>'+
    '<div class="sok" style="margin-bottom:14px">⚡ Live data via API ('+fN(S.data.length)+' terms, '+S.pullDays+'-day range)</div>'+
    '<div class="grid2"><div class="card"><h3>⚡ Negation Thresholds</h3><div class="desc">Terms exceeding these get flagged.</div>'+
    '<span class="lbl">PRESETS</span><div class="presets">'+[["🟢 Conservative",20,20,60],["🟡 Moderate",10,10,45],["🔴 Aggressive",5,5,30]].map(x=>'<div class="pre" data-pre="'+x[1]+","+x[2]+","+x[3]+'"><b>'+x[0]+'</b><small>'+x[1]+' / $'+x[2]+'</small></div>').join("")+'</div>'+
    slH("minClicks","MIN CLICKS",1,50,th.minClicks,th.minClicks)+slH("maxSpend","MAX SPEND $",1,100,th.maxSpend,"$"+th.maxSpend)+slH("maxAcos","MAX ACOS %",10,150,th.maxAcos,th.maxAcos+"%")+
    '<label class="flex gap8" style="padding:10px;background:var(--bg5);border-radius:8px;border:1px solid var(--b2);cursor:pointer;margin-top:4px"><input type="checkbox" id="cbZ" '+(th.zeroOnly?"checked":"")+'><div><b style="font-size:11px;color:var(--t)">Zero-order only</b></div></label></div>'+
    '<div style="display:flex;flex-direction:column;gap:14px"><div class="card"><h3>⚙️ Settings</h3>'+
    '<span class="lbl mt8">LEVEL</span><div class="opts">'+[["adgroup","🎯 Ad Group"],["campaign","📦 Campaign"]].map(x=>'<div class="opt '+(S.negLevel===x[0]?"on":"")+'" data-nl="'+x[0]+'"><b>'+x[1]+'</b></div>').join("")+'</div>'+
    '<span class="lbl">MATCH</span><div class="opts">'+[["exact","Neg Exact"],["phrase","Neg Phrase"]].map(x=>'<div class="opt '+(S.negMatch===x[0]?"on":"")+'" data-nm="'+x[0]+'"><b>'+x[1]+'</b></div>').join("")+'</div></div>'+
    '<div class="card" style="background:linear-gradient(135deg,var(--bg3),#14101e);border-color:#ef444418;flex:1"><h3>📊 Impact</h3>'+
    '<div class="impact mt12"><div class="imp" style="background:#ef44440a"><b style="color:var(--r)" id="iv0">'+neg.length+'</b><small>NEGATE</small></div><div class="imp" style="background:#f973160a"><b style="color:var(--o)" id="iv1">$'+waste.toFixed(2)+'</b><small>WASTED</small></div><div class="imp" style="background:#eab3080a"><b style="color:var(--y)" id="iv2">'+wrn.length+'</b><small>WARNING</small></div><div class="imp" style="background:#22c55e0a"><b style="color:var(--g)" id="iv3">'+(pi.spend?((waste/pi.spend)*100).toFixed(1):"0")+'%</b><small>% SPEND</small></div></div>'+
    '<button class="btn btn-r mt16" style="width:100%;padding:14px;font-size:14px" id="btnRev" '+(neg.length===0?"disabled":"")+'>Review '+neg.length+' Terms →</button></div></div></div>'+
    '<button class="btn btn-s mt16" onclick="S.step=\'pull\';R()">← Back</button></div></div></div>';
}
function slH(k,l,mn,mx,v,d){return'<div class="sl"><span class="lbl">'+l+'</span><div class="sl-r"><input type="range" id="sl-'+k+'" min="'+mn+'" max="'+mx+'" value="'+v+'"><div class="sl-v" id="sv-'+k+'">'+d+'</div></div></div>';}

function rReview(){
  reCls();const cl=S.cls,neg=cl.filter(t=>t.st==="negate"),wrn=cl.filter(t=>t.st==="warning");
  let disp=cl.filter(t=>S.filter==="all"||t.st===S.filter).filter(t=>!S.search||t.searchTerm.toLowerCase().includes(S.search.toLowerCase()));
  disp.sort((a,b)=>{const m=S.dir==="desc"?-1:1;let av=a[S.sort],bv=b[S.sort];if(typeof av==="string")return av.localeCompare(bv)*m;return(av||0)>(bv||0)?m:(av||0)<(bv||0)?-m:0;});
  const selS=[...S.sel].reduce((s,i)=>s+(cl[i]?cl[i].spend:0),0);
  const ma=S.th.maxAcos/100;
  const si=f=>S.sort===f?(S.dir==="desc"?"↓":"↑"):'<span style="opacity:.22">↕</span>';
  const allCk=disp.length>0&&disp.every(t=>S.sel.has(cl.indexOf(t)));
  let rows="";
  for(let di=0;di<disp.length;di++){const t=disp[di],gi=cl.indexOf(t),sel=S.sel.has(gi);
    const pc=t.st==="negate"?"pill-r":t.st==="warning"?"pill-y":"pill-g";
    const pl=t.st==="negate"?"⛔ NEGATE":t.st==="warning"?"⚠️ WATCH":"✅ SAFE";
    rows+='<tr class="'+(sel?"sel":"")+'" data-i="'+gi+'"><td class="tc"><input type="checkbox" class="rc" data-i="'+gi+'" '+(sel?"checked":"")+'></td><td class="tc"><span class="pill '+pc+'">'+pl+'</span></td><td class="tl st-cell" title="'+esc(t.searchTerm)+'">'+esc(t.searchTerm)+'</td><td class="tl camp-cell">'+esc(t.campaign)+'</td><td class="tl ag-cell">'+esc(t.adGroup)+'</td><td class="tr" style="color:var(--t3)">'+fN(t.impressions)+'</td><td class="tr" style="font-weight:'+(t.st==="negate"?700:400)+'">'+t.clicks+'</td><td class="tr" style="color:'+(t.st==="negate"?"var(--o)":"var(--t2)")+';font-weight:'+(t.st==="negate"?800:400)+'">'+f$(t.spend)+'</td><td class="tr" style="color:'+(t.sales>0?"var(--g)":"var(--t5)")+'">'+f$(t.sales)+'</td><td class="tr" style="color:'+(t.orders===0?"var(--r)":"var(--g)")+';font-weight:700">'+t.orders+'</td><td class="tr" style="color:'+(t.acos>ma?"var(--r)":t.acos>0?"var(--t)":"var(--t5)")+'">'+(t.acos>0?fP(t.acos):"—")+'</td></tr>';}
  return hdr()+
    '<div class="tbar"><div class="flex gap8">'+[["negate","⛔ "+neg.length,"on"],["warning","⚠️ "+wrn.length,"ony"],["all","All "+cl.length,"ong"]].map(x=>'<button class="fbtn '+(S.filter===x[0]?x[2]:"")+'" data-fl="'+x[0]+'">'+x[1]+'</button>').join("")+
    '<input type="text" id="sinp" placeholder="🔍 Filter..." value="'+esc(S.search)+'" style="width:160px;margin-left:8px;padding:5px 10px;font-size:11px;background:var(--bg5);border:1px solid var(--b2);border-radius:6px;color:var(--t);outline:none"></div>'+
    '<div class="flex gap8"><span style="font-size:10px;color:var(--t4)">'+disp.length+' shown • '+S.sel.size+' sel</span>'+
    '<button class="btn btn-s btn-sm" onclick="S.step=\'thresholds\';R()">← Back</button>'+
    '<button class="btn btn-r btn-sm" id="btnApply" '+(S.sel.size===0?"disabled":"")+'>Apply ('+S.sel.size+') →</button></div></div>'+
    '<div class="table-container"><table><thead><tr>'+
    '<th style="width:36px"><input type="checkbox" id="ckAll" '+(allCk?"checked":"")+'></th>'+
    '<th class="tc" style="width:80px">STATUS</th>'+
    '<th class="tl" data-so="searchTerm" style="min-width:180px">SEARCH TERM '+si("searchTerm")+'</th>'+
    '<th class="tl" data-so="campaign" style="min-width:140px">CAMPAIGN '+si("campaign")+'</th>'+
    '<th class="tl" data-so="adGroup" style="min-width:120px">AD GROUP '+si("adGroup")+'</th>'+
    '<th class="tr" style="width:60px" data-so="impressions">IMPR '+si("impressions")+'</th>'+
    '<th class="tr" style="width:56px" data-so="clicks">CLICKS '+si("clicks")+'</th>'+
    '<th class="tr" style="width:64px" data-so="spend">SPEND '+si("spend")+'</th>'+
    '<th class="tr" style="width:64px" data-so="sales">SALES '+si("sales")+'</th>'+
    '<th class="tr" style="width:44px" data-so="orders">ORD '+si("orders")+'</th>'+
    '<th class="tr" style="width:52px" data-so="acos">ACOS '+si("acos")+'</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table>'+(!disp.length?'<div class="tc" style="padding:40px;color:var(--t5)">No terms match.</div>':"")+'</div>'+
    (S.sel.size>0?'<div class="bbar"><div class="flex"><div class="bbar-n">'+S.sel.size+'</div><div><div style="font-size:12px;font-weight:700;color:var(--w)">terms selected</div><div style="font-size:10px;color:var(--t3)">'+(S.negMatch==="exact"?"Neg Exact":"Neg Phrase")+' • '+(S.negLevel==="adgroup"?"Ad Group":"Campaign")+' • <span style="color:var(--g)">$'+selS.toFixed(2)+' saved</span></div></div></div><button class="btn btn-r" id="btnApply2">Apply →</button></div>':"");
}

function rApply(){
  const waste=S.cls.filter(t=>t.st==="negate").reduce((s,t)=>s+t.spend,0);
  const ar=S.applyResult;
  let rHTML="";if(ar){if(ar.applied>0)rHTML='<div class="sok" style="padding:16px;font-size:13px;margin-bottom:16px">✅ <b>'+ar.applied+' negative keywords created via API!</b></div>';if(ar.error)rHTML='<div class="err" style="margin-bottom:16px">'+esc(ar.error)+'</div>';}
  return hdr()+loaderOvl()+
    '<div class="body"><div class="scroll"><div class="center" style="padding-top:24px">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">'+
    '<div class="card tc" style="padding:14px"><b style="font-size:20px;color:var(--r)">'+S.sel.size+'</b><br><small style="font-size:7px;color:var(--t4)">TO NEGATE</small></div>'+
    '<div class="card tc" style="padding:14px"><b style="font-size:20px;color:var(--o)">$'+waste.toFixed(2)+'</b><br><small style="font-size:7px;color:var(--t4)">SPEND SAVED</small></div>'+
    '<div class="card tc" style="padding:14px"><b style="font-size:20px;color:var(--g)">'+(S.negMatch==="exact"?"Exact":"Phrase")+'</b><br><small style="font-size:7px;color:var(--t4)">MATCH</small></div></div>'+
    rHTML+
    '<div class="card" style="border-color:#3b82f625;background:linear-gradient(135deg,#0e0e18,#100e20);margin-bottom:14px"><div class="flex gap12" style="margin-bottom:12px"><div style="font-size:26px">🤖</div><div><h3 style="color:var(--bl)">Auto-Apply via API</h3><div class="desc" style="margin:0">Creates negative keywords directly in Amazon — instant.</div></div></div>'+
    '<button class="btn btn-bl" id="btnAutoApply" style="width:100%;padding:14px;font-size:14px">🤖 Apply '+S.sel.size+' Negative Keywords</button></div>'+
    '<div class="card" style="margin-bottom:14px"><div class="flex gap12" style="margin-bottom:12px"><div style="font-size:26px">📥</div><div><h3>Download Bulk CSV</h3><div class="desc" style="margin:0">For manual upload to Amazon.</div></div></div>'+
    '<button class="btn btn-r" id="btnDL" style="width:100%;padding:14px;font-size:14px">📥 Download CSV</button></div>'+
    '<div class="flex mt20" style="justify-content:center;gap:10px">'+
    '<button class="btn btn-s" onclick="S.step=\'review\';R()">← Review</button>'+
    '<button class="btn btn-bl" onclick="S.step=\'accounts\';S.data=[];S.info=null;S.sel=new Set();S.err=null;S.applyResult=null;R()">🔄 New</button></div></div></div></div>';
}

function rProfiles(){return hdr()+'<div class="body"><div class="scroll"><div class="center"><div style="font-size:22px;font-weight:900;color:var(--w);margin-bottom:6px">👤 Account Profiles</div><div style="font-size:11px;color:var(--t3);margin-bottom:20px">Save per-account thresholds for one-click negation.</div><div class="info">This feature stores profiles in your session. Configure thresholds per account and use "Run" to pull + classify + negate automatically.</div><button class="btn btn-s mt16" onclick="S.step=\'accounts\';R()">← Back</button></div></div></div>';}

// ═══ EVENT BINDING ═══
function bindAll(){
  // Account selection
  document.querySelectorAll("[data-ai]").forEach(el=>el.addEventListener("click",()=>{S.selectedProfile=S.profiles[+el.dataset.ai];S.step="pull";S.err=null;R();}));
  // Date range
  document.querySelectorAll("[data-days]").forEach(el=>el.addEventListener("click",()=>{S.pullDays=+el.dataset.days;R();}));
  // Pull
  const bp=document.getElementById("btnPull");if(bp)bp.addEventListener("click",doPull);
  // Sliders
  ["minClicks","maxSpend","maxAcos"].forEach(k=>{const el=document.getElementById("sl-"+k);if(!el)return;el.addEventListener("input",()=>{S.th[k]=parseFloat(el.value);const sv=document.getElementById("sv-"+k);if(sv){if(k==="maxAcos")sv.textContent=S.th[k]+"%";else if(k==="maxSpend")sv.textContent="$"+S.th[k];else sv.textContent=S.th[k];}updatePreview();});});
  // Presets
  document.querySelectorAll("[data-pre]").forEach(el=>el.addEventListener("click",()=>{const p=el.dataset.pre.split(",");S.th.minClicks=+p[0];S.th.maxSpend=+p[1];S.th.maxAcos=+p[2];saveSettings();R();}));
  const cbZ=document.getElementById("cbZ");if(cbZ)cbZ.addEventListener("change",()=>{S.th.zeroOnly=cbZ.checked;reCls();R();});
  document.querySelectorAll("[data-nl]").forEach(el=>el.addEventListener("click",()=>{S.negLevel=el.dataset.nl;R();}));
  document.querySelectorAll("[data-nm]").forEach(el=>el.addEventListener("click",()=>{S.negMatch=el.dataset.nm;R();}));
  const br=document.getElementById("btnRev");if(br)br.addEventListener("click",()=>{reCls();S.sel=new Set();S.cls.forEach((t,i)=>{if(t.st==="negate")S.sel.add(i);});S.step="review";saveSettings();R();});
  // Review
  document.querySelectorAll("[data-fl]").forEach(el=>el.addEventListener("click",()=>{S.filter=el.dataset.fl;R();}));
  const si=document.getElementById("sinp");if(si)si.addEventListener("input",()=>{S.search=si.value;R();setTimeout(()=>{const i=document.getElementById("sinp");if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},0);});
  document.querySelectorAll("[data-so]").forEach(th=>th.addEventListener("click",()=>{const f=th.dataset.so;if(S.sort===f)S.dir=S.dir==="desc"?"asc":"desc";else{S.sort=f;S.dir="desc";}R();}));
  document.querySelectorAll(".rc").forEach(cb=>cb.addEventListener("change",e=>{e.stopPropagation();const i=+cb.dataset.i;S.sel.has(i)?S.sel.delete(i):S.sel.add(i);R();}));
  document.querySelectorAll("tr[data-i]").forEach(tr=>tr.addEventListener("click",e=>{if(e.target.type==="checkbox")return;const i=+tr.dataset.i;S.sel.has(i)?S.sel.delete(i):S.sel.add(i);R();}));
  const ca=document.getElementById("ckAll");if(ca)ca.addEventListener("change",()=>{const cl=S.cls;const disp=cl.filter(t=>S.filter==="all"||t.st===S.filter).filter(t=>!S.search||t.searchTerm.toLowerCase().includes(S.search.toLowerCase()));const idxs=disp.map(t=>cl.indexOf(t));const all=idxs.every(i=>S.sel.has(i));idxs.forEach(i=>{all?S.sel.delete(i):S.sel.add(i);});R();});
  const ba=document.getElementById("btnApply");if(ba)ba.addEventListener("click",()=>{S.step="apply";S.applyResult=null;R();});
  const ba2=document.getElementById("btnApply2");if(ba2)ba2.addEventListener("click",()=>{S.step="apply";S.applyResult=null;R();});
  // Apply
  const baa=document.getElementById("btnAutoApply");if(baa)baa.addEventListener("click",doAutoApply);
  const bdl=document.getElementById("btnDL");if(bdl)bdl.addEventListener("click",doDL);
}

// ═══ ACTIONS ═══
async function doPull(){
  if(!S.selectedProfile)return;
  S.loading=true;S.loadingMsg="Requesting search term report...";S.err=null;R();
  try{
    const rr=await fetch("/api/report/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId:S.selectedProfile.profileId,days:S.pullDays,region:S.selectedProfile.region})}).then(r=>r.json());
    if(rr.error)throw new Error(rr.error);
    S.loadingMsg="Report queued (ID: "+rr.reportId+"). Polling...";updLoad();
    // Poll
    let data=null;
    for(let i=0;i<30;i++){
      await new Promise(r=>setTimeout(r,4000));
      const sr=await fetch("/api/report/status/"+rr.reportId+"?profileId="+S.selectedProfile.profileId+"&region="+(S.selectedProfile.region||"NA")).then(r=>r.json());
      if(sr.status==="SUCCESS"&&sr.location){
        S.loadingMsg="Downloading report...";updLoad();
        data=await fetch("/api/report/download?url="+encodeURIComponent(sr.location)+"&profileId="+S.selectedProfile.profileId+"&region="+(S.selectedProfile.region||"NA")).then(r=>r.json());
        break;
      }
      if(sr.status==="FAILURE")throw new Error("Report failed: "+(sr.statusDetails||"Unknown"));
      S.loadingMsg="Generating report... ("+((i+1)*4)+"s)";updLoad();
    }
    S.loading=false;
    if(!data||!data.length){S.err="Report returned 0 search terms.";R();return;}
    if(data.error)throw new Error(data.error);
    S.data=data;S.info={total:data.length,camps:new Set(data.map(d=>d.campaign)).size,ags:new Set(data.map(d=>d.adGroup)).size,spend:data.reduce((s,d)=>s+d.spend,0),sales:data.reduce((s,d)=>s+d.sales,0),hasIds:data.some(d=>!!d.campaignId)};
    S.step="thresholds";R();
  }catch(e){S.loading=false;S.err=e.message;R();}
}

async function doAutoApply(){
  const terms=[];S.sel.forEach(i=>{if(S.cls[i])terms.push(S.cls[i]);});if(!terms.length)return;
  S.loading=true;S.loadingMsg="Applying "+terms.length+" negative keywords...";R();
  try{
    const r=await fetch("/api/negate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId:S.selectedProfile.profileId,region:S.selectedProfile.region||"NA",keywords:terms.map(t=>({campaignId:t.campaignId,adGroupId:S.negLevel==="adgroup"?t.adGroupId:undefined,searchTerm:t.searchTerm,matchType:S.negMatch==="exact"?"negativeExact":"negativePhrase"})),level:S.negLevel})}).then(r=>r.json());
    S.loading=false;S.applyResult=r;R();
  }catch(e){S.loading=false;S.applyResult={error:e.message};R();}
}

function doDL(){
  const terms=[];S.sel.forEach(i=>{if(S.cls[i])terms.push(S.cls[i]);});if(!terms.length)return;
  const mt=S.negMatch==="exact"?"negativeExact":"negativePhrase";
  const ag=S.negLevel==="adgroup";
  const h="Product,Entity,Operation,Campaign ID,Ad Group ID,Portfolio ID,Campaign Name,Ad Group Name,Campaign Name (Informational only),Ad Group Name (Informational only),Campaign State (Informational only),Ad Group State (Informational only),Campaign Bidding Strategy,Ad Group Default Bid,State,Keyword or Product Targeting,Product Targeting ID,Match Type,SKU,Campaign Start Date,Campaign End Date,Keyword Bid,Keyword or Product Targeting ID";
  const rows=[h];const seen=new Set();
  terms.forEach(t=>{const k=(ag?t.campaign+"||"+t.adGroup+"||":t.campaign+"||")+t.searchTerm;if(seen.has(k))return;seen.add(k);const q=s=>'"'+(s||"").replace(/"/g,'""')+'"';rows.push(["Sponsored Products",ag?"Negative keyword":"Campaign negative keyword","Create",t.campaignId||"",ag?(t.adGroupId||""):"","","","",q(t.campaign),ag?q(t.adGroup):"","","","","","enabled",q(t.searchTerm),"",mt,"","","","",""].join(","));});
  const csv=rows.join("\n");const blob=new Blob([csv],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="negative_keywords_"+new Date().toISOString().slice(0,10)+".csv";a.click();
}

function updatePreview(){reCls();const neg=S.cls.filter(t=>t.st==="negate"),wrn=S.cls.filter(t=>t.st==="warning"),w=neg.reduce((s,t)=>s+t.spend,0);const u=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};u("iv0",neg.length);u("iv1","$"+w.toFixed(2));u("iv2",wrn.length);u("iv3",(S.info&&S.info.spend?((w/S.info.spend)*100).toFixed(1):"0")+"%");const rb=document.getElementById("btnRev");if(rb){rb.disabled=neg.length===0;rb.textContent="Review "+neg.length+" Terms →";}}
function updLoad(){const el=document.getElementById("loadMsg");if(el)el.textContent=S.loadingMsg;}
function saveSettings(){fetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({th:S.th,negLevel:S.negLevel,negMatch:S.negMatch})});}
async function refreshProfiles(){S.loading=true;S.loadingMsg="Refreshing accounts...";R();try{S.profiles=await fetch("/api/profiles").then(r=>r.json());S.loading=false;R();}catch(e){S.loading=false;R();}}

init();
