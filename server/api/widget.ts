/**
 * Widget API Route
 *
 * Serves the embeddable booking widget JavaScript file at /widget.js.
 * The script is inlined as a template literal so it works without a
 * separate build step and is fully self-contained.
 */

import { Router } from "express";

const widgetRouter = Router();

// ── Inlined, minified widget script ─────────────────────────────────────────
// Keep this under 5 KB minified. It is served with permissive CORS so any
// third-party site can embed it via a <script> tag.
const WIDGET_SCRIPT = `(function(){if(window.__REBOOKED_WIDGET_LOADED)return;window.__REBOOKED_WIDGET_LOADED=true;var s=document.currentScript;var slug=s&&s.getAttribute("data-slug")||"";var color=s&&s.getAttribute("data-color")||"#00A896";var pos=s&&s.getAttribute("data-position")||"right";var label=s&&s.getAttribute("data-text")||"Book Now";if(!slug){console.warn("[Rebooked Widget] Missing data-slug attribute.");return;}var origin=s&&s.src?new URL(s.src).origin:location.origin;var bookUrl=origin+"/book/"+encodeURIComponent(slug)+"?embed=true";function ce(tag,st){var el=document.createElement(tag);for(var k in st)el.style[k]=st[k];return el;}var btn=ce("button",{position:"fixed",bottom:"20px",zIndex:"9999",background:color,color:"#fff",border:"none",borderRadius:"28px",padding:"12px 24px",fontSize:"15px",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",fontWeight:"600",cursor:"pointer",boxShadow:"0 4px 14px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:"8px",transition:"transform .2s,box-shadow .2s"});btn.style[pos==="left"?"left":"right"]="20px";btn.textContent="\\uD83D\\uDCC5 "+label;btn.setAttribute("aria-label",label);btn.onmouseenter=function(){btn.style.transform="scale(1.05)";btn.style.boxShadow="0 6px 20px rgba(0,0,0,0.3)";};btn.onmouseleave=function(){btn.style.transform="scale(1)";btn.style.boxShadow="0 4px 14px rgba(0,0,0,0.25)";};var ov=null;function openM(){if(ov)return;ov=ce("div",{position:"fixed",top:"0",left:"0",width:"100vw",height:"100vh",background:"rgba(0,0,0,0.6)",zIndex:"10000",display:"flex",alignItems:"center",justifyContent:"center",opacity:"0",transition:"opacity .25s"});var ct=ce("div",{position:"relative",width:"90vw",maxWidth:"480px",height:"85vh",maxHeight:"700px",borderRadius:"16px",overflow:"hidden",background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"});var cb=ce("button",{position:"absolute",top:"8px",right:"8px",zIndex:"10001",background:"rgba(0,0,0,0.5)",color:"#fff",border:"none",borderRadius:"50%",width:"32px",height:"32px",fontSize:"18px",lineHeight:"32px",textAlign:"center",cursor:"pointer",padding:"0"});cb.textContent="\\u2715";cb.setAttribute("aria-label","Close booking widget");var ifr=ce("iframe",{width:"100%",height:"100%",border:"none"});ifr.src=bookUrl;ifr.title="Book an appointment";ifr.allow="payment";ct.appendChild(cb);ct.appendChild(ifr);ov.appendChild(ct);document.body.appendChild(ov);requestAnimationFrame(function(){if(ov)ov.style.opacity="1";});cb.onclick=closeM;ov.onclick=function(e){if(e.target===ov)closeM();};document.addEventListener("keydown",escH);}function closeM(){if(!ov)return;ov.style.opacity="0";var r=ov;setTimeout(function(){r.remove();},250);ov=null;document.removeEventListener("keydown",escH);}function escH(e){if(e.key==="Escape")closeM();}btn.onclick=openM;window.addEventListener("message",function(e){if(e.data==="rebooked:close")closeM();});document.body.appendChild(btn);})();`;

widgetRouter.get("/widget.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(WIDGET_SCRIPT);
});

export { widgetRouter };
