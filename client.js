// Generated from src/client.js by scripts/build-client.mjs. Do not edit.
window.__ModuleLoader__.load({
  id: "dsh-plugin-always-on-top",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var T=Object.create;var d=Object.defineProperty;var O=Object.getOwnPropertyDescriptor;var R=Object.getOwnPropertyNames;var S=Object.getPrototypeOf,C=Object.prototype.hasOwnProperty;var E=(e,r)=>{for(var t in r)d(e,t,{get:r[t],enumerable:!0})},y=(e,r,t,a)=>{if(r&&typeof r=="object"||typeof r=="function")for(let n of R(r))!C.call(e,n)&&n!==t&&d(e,n,{get:()=>r[n],enumerable:!(a=O(r,n))||a.enumerable});return e};var A=(e,r,t)=>(t=e!=null?T(S(e)):{},y(r||!e||!e.__esModule?d(t,"default",{value:e,enumerable:!0}):t,e)),H=e=>y(d({},"__esModule",{value:!0}),e);var V={};E(V,{apply:()=>_,inject:()=>U});module.exports=H(V);var o=A(require("react"),1),l=o.createElement,c="dsh-always-on-top",b="/__dsh/always-on-top",k={title:"Always on top",active:"Always on top is on. Click to turn it off.",inactive:"Always on top is off. Click to keep DeepSeek Harness above other windows.",busy:"Changing the window\u2026",unsupported:"Always on top is only available in the DeepSeek Harness desktop app.",unsupportedFuse:"This DeepSeek Harness build does not allow window debugging, so the pin is unavailable.",unsupportedRuntime:"This DeepSeek Harness runtime is too old for the window channel.",unsupportedPlatform:"Window pinning is not supported on this platform yet.",error:"Could not change the window. Click to try again.",stateFailed:"Could not read the window state. Click to try again."},D={title:"\u7A97\u53E3\u7F6E\u9876",active:"\u7A97\u53E3\u5DF2\u7F6E\u9876\u3002\u70B9\u51FB\u53D6\u6D88\u3002",inactive:"\u7A97\u53E3\u672A\u7F6E\u9876\u3002\u70B9\u51FB\u8BA9 DeepSeek Harness \u59CB\u7EC8\u663E\u793A\u5728\u5176\u4ED6\u7A97\u53E3\u4E0A\u65B9\u3002",busy:"\u6B63\u5728\u8C03\u6574\u7A97\u53E3\u2026",unsupported:"\u7A97\u53E3\u7F6E\u9876\u4EC5\u5728 DeepSeek Harness \u684C\u9762\u5E94\u7528\u4E2D\u53EF\u7528\u3002",unsupportedFuse:"\u6B64 DeepSeek Harness \u6784\u5EFA\u672A\u542F\u7528\u7A97\u53E3\u8C03\u8BD5\uFF0C\u65E0\u6CD5\u4F7F\u7528\u7F6E\u9876\u3002",unsupportedRuntime:"\u6B64 DeepSeek Harness \u8FD0\u884C\u65F6\u7248\u672C\u8FC7\u65E7\uFF0C\u4E0D\u652F\u6301\u7A97\u53E3\u901A\u9053\u3002",unsupportedPlatform:"\u6B64\u5E73\u53F0\u6682\u4E0D\u652F\u6301\u7A97\u53E3\u7F6E\u9876\u3002",error:"\u65E0\u6CD5\u8C03\u6574\u7A97\u53E3\u3002\u70B9\u51FB\u91CD\u8BD5\u3002",stateFailed:"\u65E0\u6CD5\u8BFB\u53D6\u7A97\u53E3\u72B6\u6001\u3002\u70B9\u51FB\u91CD\u8BD5\u3002"},P=`
.dshat-trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0 1px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease, opacity 100ms ease;
}
.dshat-trigger:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshat-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dshat-trigger[data-active='true'] {
  color: #ffffff;
  background: var(--dsw-alias-state-business-primary, #4d6bfe);
}
.dshat-trigger[data-active='true']:hover {
  color: #ffffff;
  background: var(--dsw-alias-state-business-primary, #4d6bfe);
  filter: brightness(1.08);
}
.dshat-trigger[data-busy='true'] {
  opacity: 0.55;
  cursor: progress;
}
.dshat-trigger[data-unsupported='true'] {
  opacity: 0.45;
  cursor: not-allowed;
}
.dshat-trigger svg {
  display: block;
  width: 15px;
  height: 15px;
}
`;function j(){if(typeof document>"u")return()=>{};let e=document.createElement("style");return e.dataset.dshAlwaysOnTop="",e.textContent=P,document.head.appendChild(e),()=>{e.remove()}}function x(e){let[,r]=o.useReducer(a=>a+1,0);o.useEffect(()=>e.locale.subscribe(r),[e]);let t=o.useMemo(()=>e.locale.bind(c),[e]);return o.useCallback(a=>{let n;try{n=t(a)}catch{n=a}return typeof n!="string"||n===a?k[a]??a:n},[t])}function F(){return l("svg",{viewBox:"0 0 24 24",width:15,height:15,fill:"none",stroke:"currentColor",strokeWidth:1.5,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":!0,focusable:!1},l("path",{d:"M12 17v5"}),l("path",{d:"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"}))}async function m(e){let r;try{r=await e.json()}catch{return{supported:!0,error:"unreadable"}}return r!==null&&typeof r=="object"&&r.supported===!1?{supported:!1,reason:typeof r.reason=="string"?r.reason:""}:!e.ok||r===null||typeof r!="object"||r.ok!==!0?{supported:!0,error:r&&typeof r.error=="string"?r.error:"request-failed"}:{supported:!0,alwaysOnTop:r.alwaysOnTop===!0}}async function g(e){try{let r=await fetch(b,{method:"GET",cache:"no-store",signal:e});return await m(r)}catch(r){if(r&&r.name==="AbortError")throw r;return{supported:!0,error:"network"}}}async function L(e){try{let r=await fetch(b,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({alwaysOnTop:e}),cache:"no-store"});return await m(r)}catch{return{supported:!0,error:"network"}}}var N={"desktop-only":"unsupported","inspect-disabled":"unsupportedFuse","inspect-unknown":"unsupportedFuse","runtime-too-old":"unsupportedRuntime","unsupported-platform":"unsupportedPlatform"};function z(e,r){return e(N[r]??"unsupported")}function M(e){let r=x(e.clientCtx),[t,a]=o.useState({phase:"loading",supported:!0,alwaysOnTop:!1,known:!1,error:"",reason:""}),n=o.useRef(t);n.current=t,o.useEffect(()=>{let s=new AbortController,i=!0;return g(s.signal).then(p=>{if(i){if(!p.supported){a({phase:"unsupported",supported:!1,alwaysOnTop:!1,known:!1,error:"",reason:p.reason??""});return}if(p.error){a({phase:"error",supported:!0,alwaysOnTop:!1,known:!1,error:p.error});return}a({phase:"idle",supported:!0,alwaysOnTop:p.alwaysOnTop===!0,known:!0,error:""})}}).catch(p=>{!i||p&&p.name==="AbortError"||a({phase:"error",supported:!0,alwaysOnTop:!1,known:!1,error:"network"})}),()=>{i=!1,s.abort()}},[]);let h=o.useCallback(async()=>{a(i=>({...i,phase:"busy",error:""}));let s=await g();if(!s.supported){a({phase:"unsupported",supported:!1,alwaysOnTop:!1,known:!1,error:"",reason:s.reason??""});return}if(s.error){a({phase:"error",supported:!0,alwaysOnTop:!1,known:!1,error:s.error});return}a({phase:"idle",supported:!0,alwaysOnTop:s.alwaysOnTop===!0,known:!0,error:""})},[]),v=o.useCallback(async()=>{let s=n.current;if(s.phase==="loading"||s.phase==="busy"||s.phase==="unsupported")return;if(!s.known){await h();return}let i=!s.alwaysOnTop;a({...s,phase:"busy",error:""});let p=await L(i);if(!p.supported){a({phase:"unsupported",supported:!1,alwaysOnTop:!1,known:!1,error:"",reason:p.reason??""});return}if(p.error){a({...s,phase:"error",error:p.error});return}a({phase:"idle",supported:!0,alwaysOnTop:p.alwaysOnTop===!0,known:!0,error:""})},[h]),f=t.supported&&t.alwaysOnTop,u;t.phase==="unsupported"?u=z(r,t.reason):t.phase==="busy"?u=r("busy"):t.phase==="error"?u=r(t.known?"error":"stateFailed"):t.phase==="loading"?u=r("busy"):u=r(f?"active":"inactive");let w=t.phase==="unsupported"||t.phase==="loading"||t.phase==="busy";return l("button",{type:"button",className:"dshat-trigger",onClick:()=>{w||v()},"aria-label":u,"aria-pressed":f,"aria-disabled":w?"true":"false",title:u,"data-active":f?"true":"false","data-busy":t.phase==="busy"||t.phase==="loading"?"true":"false","data-unsupported":t.phase==="unsupported"?"true":"false"},l(F))}var U=["slots","locale"];function _(e){let r=e.locale.bind(c),t=a=>l(M,{...a,clientCtx:e});e.effect(()=>j(),"always-on-top: styles"),e.effect(()=>e.locale.register(c,"en",k),"always-on-top: en locale"),e.effect(()=>e.locale.register(c,"zh",D),"always-on-top: zh locale"),e.effect(()=>e.slots.inject("conversation.input.right",()=>e.slots.register({name:"conversation.input.right",id:"always-on-top",order:10.5,label:()=>r("title")},t)),"always-on-top: composer trigger")}

    return module.exports;
  },
});
