// Builds docs/preview/gennex-color.js (iife bundle of src/) and docs/preview/theme.html (live theme preview).
// Run: bun scripts/preview-theme.ts
import { ALPHA_TEXT, PAIRS } from "../test/pairs";

const built = await Bun.build({ entrypoints: ["scripts/theme-entry.ts"], target: "browser", format: "iife", minify: true, outdir: "docs/preview", naming: "gennex-color.js" });
if (!built.success) throw new Error(built.logs.join("\n"));

const html = String.raw`<!doctype html><meta charset="utf-8"><title>gennex-color: semantic theme preview</title>
<style>
:root{color-scheme:light}body{margin:0;font:14px system-ui;background:#6b6b6b;color:#eee}
#ctl{position:sticky;top:0;z-index:5;background:#222;padding:10px 14px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;border-bottom:1px solid #444}
#ctl label{display:flex;gap:6px;align-items:center;font-size:12px}#ctl input[type=number]{width:56px}#ctl button{padding:3px 8px;border-radius:4px;border:1px solid #666;background:#333;color:#eee;cursor:pointer;font-size:12px}
#ctl .nm{min-width:170px;font-weight:600}
main{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}
.panel{border-radius:8px;overflow:hidden;background:var(--background);color:var(--foreground);padding:16px;display:flex;flex-direction:column;gap:14px;border:1px solid var(--border)}
.panel h3{margin:0;font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.05em}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.muted{color:var(--muted-foreground)}
.card{background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px}
.btn{border:1px solid transparent;border-radius:8px;padding:7px 12px;font:600 13px system-ui;cursor:default}
.primary{background:var(--primary);color:var(--primary-foreground)}.hover{background:var(--primary-hover);color:var(--primary-foreground)}
.secondary{background:var(--secondary);color:var(--secondary-foreground)}.accent{background:var(--accent);color:var(--accent-foreground)}
.destructive{background:var(--destructive);color:var(--destructive-foreground)}
.outline{background:transparent;color:var(--foreground);border-color:var(--input)}
.input{border:1px solid var(--input);border-radius:8px;padding:7px 10px;background:var(--background);color:var(--foreground);min-width:150px}
.focus{outline:2px solid var(--ring);outline-offset:2px}
.alert{border:1px solid;border-radius:8px;padding:8px 10px;display:flex;gap:10px;align-items:center}
.alert b{border-radius:6px;padding:2px 8px;font-size:12px}
.pop{background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);border-radius:10px;padding:4px;width:220px;box-shadow:0 6px 18px #0003}
.pop div{padding:6px 10px;border-radius:6px}.pop .sel{background:var(--accent);color:var(--accent-foreground)}
.muteds{background:var(--muted);color:var(--muted-foreground);padding:8px 10px;border-radius:8px}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:4px;font:10px monospace}.sw i{padding:6px;border-radius:4px;border:1px solid #8884;font-style:normal;min-height:30px}
#checks{grid-column:1/-1;background:#222;border-radius:8px;padding:12px;font:12px monospace;columns:2}
.bad{color:#ff8a8a}.good{color:#9be09b}
</style>
<div id="ctl">
 <span class="nm" id="name"></span>
 <label>brand hue <input id="hue" type="range" min="0" max="360" step="1" value="255"><input id="hueN" type="number" min="0" max="360" step="1" value="255"></label>
 <label>kappa <input id="kappa" type="range" min="0.35" max="0.85" step="0.05" value="0.85"><span id="kappaV">0.85</span></label>
 <label>neutral <select id="neutral"><option>neutral</option><option>cool</option><option>warm</option><option>auto</option></select></label>
 <label>primary <select id="pmode"><option value="accessible">accessible (default)</option><option value="vivid">vivid (+primary-text)</option></select></label>
 <label>page <select id="page"><option value="1">= s1 (default)</option><option value="2">= s2</option></select></label>
 <label>status hues
  <input id="s_destructive" type="number" value="25" title="destructive"><input id="s_success" type="number" value="156" title="success"><input id="s_warning" type="number" value="80" title="warning"><input id="s_info" type="number" value="255" title="info"></label>
 <span id="presets"></span>
</div>
<main id="out"></main>
<script src="gennex-color.js"></script>
<script>
const G = window.gennex, $ = (id) => document.getElementById(id);
const STATUS = ["destructive","success","warning","info"];
function lin(c){c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4}
function lum(h){const n=parseInt(h.slice(1),16);return 0.2126*lin(n>>16&255)+0.7152*lin(n>>8&255)+0.0722*lin(n&255)}
function cr(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)}
// The pair table is generated from test/pairs.ts when this page is built (one source of truth).
const PAIRS = ${JSON.stringify(PAIRS)};
const INFO = ${JSON.stringify(ALPHA_TEXT)};
function mix(top,bottom,a){const ch=(h)=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]};const t=ch(top),b=ch(bottom);return "#"+t.map((v,i)=>Math.round(v*a+b[i]*(1-a)).toString(16).padStart(2,"0")).join("")}
function ratio(p,t){const surface=t[p.over||"background"];const bg=p.bgA?mix(t[p.bg],surface,p.bgA):t[p.bg];const fg=p.fgA?mix(t[p.fg],bg,p.fgA):t[p.fg];return cr(fg,bg)}
function panel(mode, t){
 const vars = Object.entries(t).map(([k,v])=>"--"+k+":"+v).join(";");
 const alert = (s,label)=>'<div class="alert" style="background:var(--'+s+'-subtle);border-color:var(--'+s+'-border);color:var(--'+s+'-text)"><b style="background:var(--'+s+');color:var(--'+s+'-foreground)">'+label+'</b><span>'+label+' message, text in '+s+'-text</span></div>';
 return '<section class="panel" style="'+vars+'"><h3>'+mode+'</h3>'+
 '<div class="row"><b style="font-size:18px">Dashboard</b><span class="muted">muted-foreground description</span></div>'+
 '<div class="card"><b>Account settings</b><span class="muted">Card on the page. Border = border token.</span>'+
 '<div class="row"><input class="input" value="Input (border = input, 3:1)"><input class="input focus" value="Focused (ring)"></div>'+
 '<div class="row"><span class="btn primary">Primary</span><span class="btn hover">Primary hover</span><span class="btn secondary">Secondary</span><span class="btn accent">Accent</span><span class="btn outline">Outline</span><span class="btn destructive">Delete</span></div>'+
 '<div class="muteds">muted surface with muted-foreground</div>'+
 '<div class="row"><span style="color:var(--primary)">text-primary link</span><span style="color:var(--primary-text)">primary-text link</span><span class="muted">(same in accessible; vivid separates them)</span></div></div>'+
 '<div style="display:grid;gap:6px">'+alert("success","Success")+alert("warning","Warning")+alert("info","Info")+alert("destructive","Error")+'</div>'+
 '<div class="pop"><div>Popover item</div><div class="sel">Highlighted (accent)</div><div>Another item</div></div>'+
 '<div class="sw">'+Object.entries(t).map(([k,v])=>'<i style="background:'+v+';color:'+(cr(v,"#000000")>cr(v,"#ffffff")?"#000":"#fff")+'">'+k+'<br>'+v+'</i>').join("")+'</div></section>'
}
function render(){
 const hue=+$("hue").value; $("hueN").value=hue; $("kappaV").textContent=$("kappa").value;
 const n=G.nameOfHue(hue); $("name").textContent=n.name+(n.kind==="sub"?" (sub-name; nearest core "+n.core+" "+(n.offset>0?"+":"")+n.offset.toFixed(1)+"°)":" (core)");
 const status={}; for(const s of STATUS)status[s]=+$("s_"+s).value;
 const th=G.buildTheme({hue,kappa:+$("kappa").value,neutral:$("neutral").value,status,pageStep:+$("page").value,primaryMode:$("pmode").value});
 $("out").innerHTML=panel("light",th.light)+panel("dark",th.dark)+'<div id="checks"></div>';
 const lines=[];let bad=0,total=0;
 for(const m of ["light","dark"])for(const p of PAIRS){if(p.modes&&!p.modes.includes(m))continue;if(p.textPrimary&&$("pmode").value==="vivid")continue;total++;const r=ratio(p,th[m]);const ok=r>=p.min;if(!ok)bad++;if(!ok||r<p.min+0.2)lines.push('<div class="'+(ok?"good":"bad")+'">'+(ok?"thin ":"FAIL ")+m+" "+p.name+" "+r.toFixed(2)+" (min "+p.min+")"+(p.src?" ["+p.src+"]":"")+"</div>")}
 const info=[];for(const m of ["light","dark"])for(const p of INFO)info.push('<div>'+m+" "+p.name+" "+ratio(p,th[m]).toFixed(2)+" ["+p.src+"]</div>");
 $("checks").innerHTML="<b>"+(total-bad)+" / "+total+" pairs pass</b> (shadcn components included; pairs within 0.2 of the gate are listed)"+lines.join("")+"<br><b>Not gated</b> (translucent text inside shadcn components, 4.5 would be needed)"+info.join("");
}
for(const id of ["hue","kappa","neutral","page","pmode","s_destructive","s_success","s_warning","s_info"])$(id).addEventListener("input",render);
$("hueN").addEventListener("input",()=>{$("hue").value=$("hueN").value;render()});
const PRE=[["red",25],["orange",52],["amber",80],["yellow",106],["lime",133],["green",156],["teal",184],["cyan",214],["blue",255],["violet",292],["magenta",325],["pink",355],["coral",40],["carrot",64]];
$("presets").innerHTML=PRE.map(([n,h])=>'<button data-h="'+h+'">'+n+" "+h+"</button>").join(" ");
$("presets").addEventListener("click",(e)=>{const h=e.target.dataset.h;if(h){$("hue").value=h;render()}});
for(const [k,v] of new URLSearchParams(location.hash.slice(1)))if($(k))$(k).value=v; // e.g. theme.html#hue=40&neutral=warm&page=2
render();
</script>`;
await Bun.write("docs/preview/theme.html", html);
console.log("wrote docs/preview/theme.html + gennex-color.js");
