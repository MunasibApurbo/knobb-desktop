function E(c,t,e,i){var s=arguments.length,r=s<3?t:i===null?i=Object.getOwnPropertyDescriptor(t,e):i,n;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(c,t,e,i);else for(var a=c.length-1;a>=0;a--)(n=c[a])&&(r=(s<3?n(r):s>3?n(t,e,r):n(t,e))||r);return s>3&&r&&Object.defineProperty(t,e,r),r}/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const wt=globalThis,Ft=wt.ShadowRoot&&(wt.ShadyCSS===void 0||wt.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Wt=Symbol(),Ht=new WeakMap;let re=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==Wt)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(Ft&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=Ht.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Ht.set(e,t))}return t}toString(){return this.cssText}};const me=c=>new re(typeof c=="string"?c:c+"",void 0,Wt),fe=(c,...t)=>{const e=c.length===1?c[0]:t.reduce((i,s,r)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+c[r+1],c[0]);return new re(e,c,Wt)},ye=(c,t)=>{if(Ft)c.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(const e of t){const i=document.createElement("style"),s=wt.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,c.appendChild(i)}},jt=Ft?c=>c:c=>c instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return me(e)})(c):c;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:ge,defineProperty:be,getOwnPropertyDescriptor:ve,getOwnPropertyNames:xe,getOwnPropertySymbols:we,getPrototypeOf:Se}=Object,V=globalThis,Gt=V.trustedTypes,$e=Gt?Gt.emptyScript:"",Pt=V.reactiveElementPolyfillSupport,ct=(c,t)=>c,St={toAttribute(c,t){switch(t){case Boolean:c=c?$e:null;break;case Object:case Array:c=c==null?c:JSON.stringify(c)}return c},fromAttribute(c,t){let e=c;switch(t){case Boolean:e=c!==null;break;case Number:e=c===null?null:Number(c);break;case Object:case Array:try{e=JSON.parse(c)}catch{e=null}}return e}},Ut=(c,t)=>!ge(c,t),Yt={attribute:!0,type:String,converter:St,reflect:!1,useDefault:!1,hasChanged:Ut};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),V.litPropertyMetadata??(V.litPropertyMetadata=new WeakMap);let it=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Yt){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);s!==void 0&&be(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:r}=ve(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:s,set(n){const a=s==null?void 0:s.call(this);r==null||r.call(this,n),this.requestUpdate(t,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Yt}static _$Ei(){if(this.hasOwnProperty(ct("elementProperties")))return;const t=Se(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(ct("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ct("properties"))){const e=this.properties,i=[...xe(e),...we(e)];for(const s of i)this.createProperty(s,e[s])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[i,s]of e)this.elementProperties.set(i,s)}this._$Eh=new Map;for(const[e,i]of this.elementProperties){const s=this._$Eu(e,i);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const s of i)e.unshift(jt(s))}else t!==void 0&&e.push(jt(t));return e}static _$Eu(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return ye(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostConnected)==null?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostDisconnected)==null?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){var r;const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){const n=(((r=i.converter)==null?void 0:r.toAttribute)!==void 0?i.converter:St).toAttribute(e,i.type);this._$Em=t,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(t,e){var r,n;const i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const a=i.getPropertyOptions(s),o=typeof a.converter=="function"?{fromAttribute:a.converter}:((r=a.converter)==null?void 0:r.fromAttribute)!==void 0?a.converter:St;this._$Em=s;const l=o.fromAttribute(e,a.type);this[s]=l??((n=this._$Ej)==null?void 0:n.get(s))??l,this._$Em=null}}requestUpdate(t,e,i,s=!1,r){var n;if(t!==void 0){const a=this.constructor;if(s===!1&&(r=this[t]),i??(i=a.getPropertyOptions(t)),!((i.hasChanged??Ut)(r,e)||i.useDefault&&i.reflect&&r===((n=this._$Ej)==null?void 0:n.get(t))&&!this.hasAttribute(a._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:r},n){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,n??e??this[t]),r!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[r,n]of this._$Ep)this[r]=n;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[r,n]of s){const{wrapped:a}=n,o=this[r];a!==!0||this._$AL.has(r)||o===void 0||this.C(r,void 0,n,o)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),(i=this._$EO)==null||i.forEach(s=>{var r;return(r=s.hostUpdate)==null?void 0:r.call(s)}),this.update(e)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(e)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(i=>{var s;return(s=i.hostUpdated)==null?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};it.elementStyles=[],it.shadowRootOptions={mode:"open"},it[ct("elementProperties")]=new Map,it[ct("finalized")]=new Map,Pt==null||Pt({ReactiveElement:it}),(V.reactiveElementVersions??(V.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const dt=globalThis,Vt=c=>c,$t=dt.trustedTypes,Zt=$t?$t.createPolicy("lit-html",{createHTML:c=>c}):void 0,ae="$lit$",Y=`lit$${Math.random().toFixed(9).slice(2)}$`,oe="?"+Y,Ae=`<${oe}>`,J=document,ut=()=>J.createComment(""),pt=c=>c===null||typeof c!="object"&&typeof c!="function",Ot=Array.isArray,ke=c=>Ot(c)||typeof(c==null?void 0:c[Symbol.iterator])=="function",_t=`[ 	
\f\r]`,ot=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Kt=/-->/g,Qt=/>/g,Z=RegExp(`>|${_t}(?:([^\\s"'>=/]+)(${_t}*=${_t}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Xt=/'/g,Jt=/"/g,le=/^(?:script|style|textarea|title)$/i,ce=c=>(t,...e)=>({_$litType$:c,strings:t,values:e}),M=ce(1),te=ce(2),st=Symbol.for("lit-noChange"),F=Symbol.for("lit-nothing"),ee=new WeakMap,K=J.createTreeWalker(J,129);function de(c,t){if(!Ot(c)||!c.hasOwnProperty("raw"))throw Error("invalid template strings array");return Zt!==void 0?Zt.createHTML(t):t}const Te=(c,t)=>{const e=c.length-1,i=[];let s,r=t===2?"<svg>":t===3?"<math>":"",n=ot;for(let a=0;a<e;a++){const o=c[a];let l,d,h=-1,y=0;for(;y<o.length&&(n.lastIndex=y,d=n.exec(o),d!==null);)y=n.lastIndex,n===ot?d[1]==="!--"?n=Kt:d[1]!==void 0?n=Qt:d[2]!==void 0?(le.test(d[2])&&(s=RegExp("</"+d[2],"g")),n=Z):d[3]!==void 0&&(n=Z):n===Z?d[0]===">"?(n=s??ot,h=-1):d[1]===void 0?h=-2:(h=n.lastIndex-d[2].length,l=d[1],n=d[3]===void 0?Z:d[3]==='"'?Jt:Xt):n===Jt||n===Xt?n=Z:n===Kt||n===Qt?n=ot:(n=Z,s=void 0);const p=n===Z&&c[a+1].startsWith("/>")?" ":"";r+=n===ot?o+Ae:h>=0?(i.push(l),o.slice(0,h)+ae+o.slice(h)+Y+p):o+Y+(h===-2?a:p)}return[de(c,r+(c[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]};class mt{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let r=0,n=0;const a=t.length-1,o=this.parts,[l,d]=Te(t,e);if(this.el=mt.createElement(l,i),K.currentNode=this.el.content,e===2||e===3){const h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(s=K.nextNode())!==null&&o.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(const h of s.getAttributeNames())if(h.endsWith(ae)){const y=d[n++],p=s.getAttribute(h).split(Y),u=/([.?@])?(.*)/.exec(y);o.push({type:1,index:r,name:u[2],strings:p,ctor:u[1]==="."?Ee:u[1]==="?"?Ce:u[1]==="@"?Ie:At}),s.removeAttribute(h)}else h.startsWith(Y)&&(o.push({type:6,index:r}),s.removeAttribute(h));if(le.test(s.tagName)){const h=s.textContent.split(Y),y=h.length-1;if(y>0){s.textContent=$t?$t.emptyScript:"";for(let p=0;p<y;p++)s.append(h[p],ut()),K.nextNode(),o.push({type:2,index:++r});s.append(h[y],ut())}}}else if(s.nodeType===8)if(s.data===oe)o.push({type:2,index:r});else{let h=-1;for(;(h=s.data.indexOf(Y,h+1))!==-1;)o.push({type:7,index:r}),h+=Y.length-1}r++}}static createElement(t,e){const i=J.createElement("template");return i.innerHTML=t,i}}function nt(c,t,e=c,i){var n,a;if(t===st)return t;let s=i!==void 0?(n=e._$Co)==null?void 0:n[i]:e._$Cl;const r=pt(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==r&&((a=s==null?void 0:s._$AO)==null||a.call(s,!1),r===void 0?s=void 0:(s=new r(c),s._$AT(c,e,i)),i!==void 0?(e._$Co??(e._$Co=[]))[i]=s:e._$Cl=s),s!==void 0&&(t=nt(c,s._$AS(c,t.values),s,i)),t}class Le{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=((t==null?void 0:t.creationScope)??J).importNode(e,!0);K.currentNode=s;let r=K.nextNode(),n=0,a=0,o=i[0];for(;o!==void 0;){if(n===o.index){let l;o.type===2?l=new ft(r,r.nextSibling,this,t):o.type===1?l=new o.ctor(r,o.name,o.strings,this,t):o.type===6&&(l=new Me(r,this,t)),this._$AV.push(l),o=i[++a]}n!==(o==null?void 0:o.index)&&(r=K.nextNode(),n++)}return K.currentNode=J,s}p(t){let e=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class ft{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=F,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=nt(this,t,e),pt(t)?t===F||t==null||t===""?(this._$AH!==F&&this._$AR(),this._$AH=F):t!==this._$AH&&t!==st&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):ke(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==F&&pt(this._$AH)?this._$AA.nextSibling.data=t:this.T(J.createTextNode(t)),this._$AH=t}$(t){var r;const{values:e,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=mt.createElement(de(i.h,i.h[0]),this.options)),i);if(((r=this._$AH)==null?void 0:r._$AD)===s)this._$AH.p(e);else{const n=new Le(s,this),a=n.u(this.options);n.p(e),this.T(a),this._$AH=n}}_$AC(t){let e=ee.get(t.strings);return e===void 0&&ee.set(t.strings,e=new mt(t)),e}k(t){Ot(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const r of t)s===e.length?e.push(i=new ft(this.O(ut()),this.O(ut()),this,this.options)):i=e[s],i._$AI(r),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,e);t!==this._$AB;){const s=Vt(t).nextSibling;Vt(t).remove(),t=s}}setConnected(t){var e;this._$AM===void 0&&(this._$Cv=t,(e=this._$AP)==null||e.call(this,t))}}class At{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,r){this.type=1,this._$AH=F,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=r,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=F}_$AI(t,e=this,i,s){const r=this.strings;let n=!1;if(r===void 0)t=nt(this,t,e,0),n=!pt(t)||t!==this._$AH&&t!==st,n&&(this._$AH=t);else{const a=t;let o,l;for(t=r[0],o=0;o<r.length-1;o++)l=nt(this,a[i+o],e,o),l===st&&(l=this._$AH[o]),n||(n=!pt(l)||l!==this._$AH[o]),l===F?t=F:t!==F&&(t+=(l??"")+r[o+1]),this._$AH[o]=l}n&&!s&&this.j(t)}j(t){t===F?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Ee extends At{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===F?void 0:t}}class Ce extends At{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==F)}}class Ie extends At{constructor(t,e,i,s,r){super(t,e,i,s,r),this.type=5}_$AI(t,e=this){if((t=nt(this,t,e,0)??F)===st)return;const i=this._$AH,s=t===F&&i!==F||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,r=t!==F&&(i===F||s);s&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}}class Me{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){nt(this,t)}}const zt=dt.litHtmlPolyfillSupport;zt==null||zt(mt,ft),(dt.litHtmlVersions??(dt.litHtmlVersions=[])).push("3.3.2");const Pe=(c,t,e)=>{const i=(e==null?void 0:e.renderBefore)??t;let s=i._$litPart$;if(s===void 0){const r=(e==null?void 0:e.renderBefore)??null;i._$litPart$=s=new ft(t.insertBefore(ut(),r),r,void 0,e??{})}return s._$AI(c),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const X=globalThis;class ht extends it{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var e;const t=super.createRenderRoot();return(e=this.renderOptions).renderBefore??(e.renderBefore=t.firstChild),t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Pe(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return st}}var ne;ht._$litElement$=!0,ht.finalized=!0,(ne=X.litElementHydrateSupport)==null||ne.call(X,{LitElement:ht});const Rt=X.litElementPolyfillSupport;Rt==null||Rt({LitElement:ht});(X.litElementVersions??(X.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const _e={attribute:!0,type:String,converter:St,reflect:!1,hasChanged:Ut},ze=(c=_e,t,e)=>{const{kind:i,metadata:s}=e;let r=globalThis.litPropertyMetadata.get(s);if(r===void 0&&globalThis.litPropertyMetadata.set(s,r=new Map),i==="setter"&&((c=Object.create(c)).wrapped=!0),r.set(e.name,c),i==="accessor"){const{name:n}=e;return{set(a){const o=t.get.call(this);t.set.call(this,a),this.requestUpdate(n,o,c,!0,a)},init(a){return a!==void 0&&this.C(n,void 0,c,a),a}}}if(i==="setter"){const{name:n}=e;return function(a){const o=this[n];t.call(this,a),this.requestUpdate(n,o,c,!0,a)}}throw Error("Unsupported decorator location: "+i)};function U(c){return(t,e)=>typeof e=="object"?ze(c,t,e):((i,s,r)=>{const n=s.hasOwnProperty(r);return s.constructor.createProperty(r,i),n?Object.getOwnPropertyDescriptor(s,r):void 0})(c,t,e)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function j(c){return U({...c,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Re=(c,t,e)=>(e.configurable=!0,e.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(c,t,e),e);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Fe(c,t){return(e,i,s)=>{const r=n=>{var a;return((a=n.renderRoot)==null?void 0:a.querySelector(c))??null};return Re(e,i,{get(){return r(this)}})}}const G={GOOGLE:{MAX_RETRIES:3,RETRY_DELAY_MS:1e3}};class Q{static delay(t){return new Promise(e=>{setTimeout(e,t)})}static isPurelyLatinScript(t){return/^[\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]*$/.test(t)}static async translate(t,e){if(!t||Array.isArray(t)&&t.length===0)return Array.isArray(t)?[]:"";const i=Array.isArray(t),s=i?t:[t],r=[],n=[];if(s.forEach((u,v)=>{u&&u.trim()&&(r.push(v),n.push(u))}),n.length===0)return i?s:s[0];const a=1500,o=new Array(n.length).fill("");let l=[],d=[],h=0;const y=async(u,v)=>{var b;if(u.length===0)return;const m=u.join(`
`);let g=0,x=!1;for(;g<G.GOOGLE.MAX_RETRIES&&!x;)try{const T=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${e}&dt=t&q=${encodeURIComponent(m)}`,I=await fetch(T);if(!I.ok)throw new Error(`Status ${I.status}`);const L=await I.json(),k=(((b=L==null?void 0:L[0])==null?void 0:b.map($=>$==null?void 0:$[0]).join(""))||"").split(`
`);v.forEach(($,O)=>{O<k.length?o[$]=k[O]:o[$]=u[O]}),x=!0}catch{g+=1,g<G.GOOGLE.MAX_RETRIES?await Q.delay(G.GOOGLE.RETRY_DELAY_MS*2**(g-1)):v.forEach((I,L)=>{o[I]=u[L]})}};for(let u=0;u<n.length;u+=1){const v=n[u];h+v.length>a&&(await y(l,d),l=[],d=[],h=0),l.push(v),d.push(u),h+=v.length}l.length>0&&await y(l,d);const p=[...s];return r.forEach((u,v)=>{p[u]=o[v]}),i?p:p[0]}static async romanize(t){const e=Array.isArray(t)?t:t.data||t.content;return e?e.some(s=>s.isWordSynced!==!1&&Array.isArray(s.text)&&s.text.length>1)?this.romanizeWordSynced(e):this.romanizeLineSynced(e):t}static async romanizeWordSynced(t){return Promise.all(t.map(async e=>{if(!e.text||!Array.isArray(e.text)||e.text.length===0||e.romanizedText)return e;const i=e.text.map(n=>n.text).join(""),[s]=await this.romanizeTexts([i]),r=e.text.map(n=>({...n,romanizedText:n.romanizedText}));return{...e,text:r,romanizedText:s||""}}))}static async romanizeLineSynced(t){const e=t.map(s=>s.romanizedText?"":Array.isArray(s.text)&&s.text.length>0?s.text.map(r=>r.text).join(""):""),i=await this.romanizeTexts(e);return t.map((s,r)=>({...s,romanizedText:i[r]||""}))}static async romanizeTexts(t){var s,r;const e=t.join(" ");if(Q.isPurelyLatinScript(e))return t;const i=[];for(const n of t)if(!n||Q.isPurelyLatinScript(n))i.push(n);else{let a=0,o=!1,l=null;for(;a<G.GOOGLE.MAX_RETRIES&&!o;)try{const d=`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(n)}`,y=await(await fetch(d)).json(),p=((r=(s=y==null?void 0:y[0])==null?void 0:s[0])==null?void 0:r[3])||n;i.push(p),o=!0}catch(d){l=d,console.warn(`GoogleService: Error romanizing text "${n}" (attempt ${a+1}/${G.GOOGLE.MAX_RETRIES}):`,d),a+=1,a<G.GOOGLE.MAX_RETRIES&&await Q.delay(G.GOOGLE.RETRY_DELAY_MS*2**(a-1))}o||(console.error(`GoogleService: Failed to romanize text "${n}" after ${G.GOOGLE.MAX_RETRIES} attempts. Last error:`,l),i.push(n))}return i}}const ie="1.1.1",lt=7e3,se=["https://lyricsplus.binimum.org","https://lyricsplus.atomix.one","https://lyricsplus-seven.vercel.app","https://lyricsplus.prjktla.workers.dev","https://lyrics-plus-backend.vercel.app"],We="apple,lyricsplus,musixmatch,spotify,musixmatch-word",Ue=["https://arran.monochrome.tf","https://api.monochrome.tf/","https://triton.squid.wtf","https://wolf.qqdl.site","https://maus.qqdl.site","https://vogel.qqdl.site","https://katze.qqdl.site","https://hund.qqdl.site","https://tidal.kinoplus.online","https://hifi-one.spotisaver.net","https://hifi-two.spotisaver.net"];class f extends ht{constructor(){super(...arguments),this.downloadFormat="auto",this.highlightColor="#ffffff",this.hoverBackgroundColor="rgba(255, 255, 255, 0.13)",this.autoScroll=!0,this.interpolate=!0,this.showRomanization=!1,this.showTranslation=!1,this._currentTime=0,this.isLoading=!1,this.activeLineIndices=[],this.activeMainWordIndices=new Map,this.activeBackgroundWordIndices=new Map,this.mainWordProgress=new Map,this.backgroundWordProgress=new Map,this.lyricsSource=null,this.availableSources=[],this.currentSourceIndex=0,this.isFetchingAlternatives=!1,this.hasFetchedAllProviders=!1,this.mainWordAnimations=new Map,this.backgroundWordAnimations=new Map,this.lastInstrumentalIndex=null,this.isUserScrolling=!1,this.isProgrammaticScroll=!1,this.isClickSeeking=!1,this.cachedLyricsLines=[],this.activeLineIds=new Set,this.currentPrimaryActiveLine=null,this.lastPrimaryActiveLine=null,this.scrollAnimationState=null,this.currentScrollOffset=0,this.animatingLines=[],this.lastActiveIndex=0,this.visibleLineIds=new Set}async toggleRomanization(){this.showRomanization=!this.showRomanization,await this.applyRomanization()}async applyRomanization(){if(this.showRomanization&&this.lyrics&&this.lyrics.some(e=>!e.romanizedText&&(!e.text||!e.text.some(i=>i.romanizedText)))){this.isLoading=!0;try{const e=await Q.romanize(this.lyrics);this.lyrics=e}catch(e){console.error("Romanization failed",e)}finally{this.isLoading=!1}}}async toggleTranslation(){this.showTranslation=!this.showTranslation,await this.applyTranslation()}async applyTranslation(){if(this.showTranslation&&this.lyrics&&this.lyrics.some(e=>!e.translation)){this.isLoading=!0;try{const e=this.lyrics.map(n=>n.translation?"":n.text.map(a=>a.text).join(""));if(e.every(n=>!n)){this.isLoading=!1;return}const i=await Q.translate(e,"en"),s=Array.isArray(i)?i:[i],r=this.lyrics.map((n,a)=>n.translation?n:{...n,translation:s[a]||void 0});this.lyrics=r}catch(e){console.error("Translation failed",e)}finally{this.isLoading=!1}}}set currentTime(t){const e=this._currentTime;this._currentTime=t,e!==t&&this.lyrics&&this._onTimeChanged(e,t)}get currentTime(){return this._currentTime}connectedCallback(){super.connectedCallback(),this.fetchLyrics()}disconnectedCallback(){super.disconnectedCallback(),this.animationFrameId&&cancelAnimationFrame(this.animationFrameId),this.userScrollTimeoutId&&clearTimeout(this.userScrollTimeoutId)}async fetchLyrics(){var t,e;this.isLoading=!0,this.lyrics=void 0,this.lyricsSource=null,this.availableSources=[],this.currentSourceIndex=0,this.isFetchingAlternatives=!1,this.hasFetchedAllProviders=!1;try{const i=await this.resolveSongMetadata(),s=!!this.musicId&&!this.songTitle&&!this.songArtist&&!this.query,r=[];if(i!=null&&i.metadata&&!s){const n=((t=i.metadata.title)==null?void 0:t.trim())||"",a=((e=i.metadata.artist)==null?void 0:e.trim())||"",o=await f.fetchLyricsFromYouLyPlus(n,a,i.metadata);o&&o.length>0&&r.push(...o)}if(r.length===0&&(i!=null&&i.metadata)){const n=await f.fetchLyricsFromTidal(i.metadata,i.catalogIsrc);n&&n.lines.length>0&&r.push({lines:n.lines,source:"Tidal"})}if(r.length===0&&(i!=null&&i.metadata)){const n=await f.fetchLyricsFromLrclib(i.metadata);n&&n.lines.length>0&&r.push({lines:n.lines,source:"LRCLIB"})}if(this.hasFetchedAllProviders=r.length===0||r.some(n=>n.source==="LRCLIB"||n.source==="Tidal"),r.length>0){this.availableSources=f.mergeAndSortSources(r),this.currentSourceIndex=0,this.lyrics=this.availableSources[0].lines,this.lyricsSource=this.availableSources[0].source,await this.onLyricsLoaded();return}this.lyrics=void 0,this.lyricsSource=null}finally{this.isLoading=!1}}async onLyricsLoaded(){this.activeLineIndices=[],this.activeMainWordIndices.clear(),this.activeBackgroundWordIndices.clear(),this.mainWordProgress.clear(),this.backgroundWordProgress.clear(),this.mainWordAnimations.clear(),this.backgroundWordAnimations.clear(),this.lyricsContainer&&(this.isProgrammaticScroll=!0,this.lyricsContainer.scrollTop=0,window.setTimeout(()=>{this.isProgrammaticScroll=!1},100)),await this.autoProcessLyrics()}async autoProcessLyrics(){this.showRomanization&&await this.applyRomanization(),this.showTranslation&&await this.applyTranslation()}static getRankForCollected(t,e){const i=t.toLowerCase(),s=e.some(a=>a.text&&Array.isArray(a.text)&&a.text.length>1),r=e.length>0&&e.every(a=>a.timestamp===0&&a.endtime===0),n=i.includes("qq")||i.includes("lyricsplus");return i.includes("apple")&&s?1:n&&s?2:i.includes("musixmatch")&&s?3:i.includes("tidal")&&s?4:i.includes("lrclib")&&s?5:i.includes("apple")&&!s&&!r?6:n&&!s&&!r?7:i.includes("musixmatch")&&!s&&!r?8:i.includes("tidal")&&!s&&!r?9:i.includes("lrclib")&&!s&&!r?10:i.includes("apple")&&r?11:n&&r?12:i.includes("musixmatch")&&r?13:i.includes("tidal")&&r?14:i.includes("lrclib")&&r?15:20}static mergeAndSortSources(t){const e=new Map;for(const i of t){const s=i.source.toLowerCase().includes("lyricsplus")?"QQ":i.source;e.has(s)||e.set(s,{...i,source:s})}return Array.from(e.values()).sort((i,s)=>f.getRankForCollected(i.source,i.lines)-f.getRankForCollected(s.source,s.lines))}async switchSource(){if(!this.isFetchingAlternatives){if(!this.hasFetchedAllProviders){this.isFetchingAlternatives=!0;try{const t=await this.resolveSongMetadata();if(t!=null&&t.metadata){const e=[];if(!this.availableSources.some(i=>i.source.toLowerCase().includes("tidal"))){const i=await f.fetchLyricsFromTidal(t.metadata,t.catalogIsrc);i&&i.lines.length>0&&e.push({lines:i.lines,source:"Tidal"})}if(!this.availableSources.some(i=>i.source.toLowerCase().includes("lrclib"))){const i=await f.fetchLyricsFromLrclib(t.metadata);i&&i.lines.length>0&&e.push({lines:i.lines,source:"LRCLIB"})}e.length>0&&(this.availableSources=f.mergeAndSortSources([...this.availableSources,...e]),this.currentSourceIndex=this.availableSources.findIndex(i=>i.source===this.lyricsSource),this.currentSourceIndex===-1&&(this.currentSourceIndex=0))}}finally{this.hasFetchedAllProviders=!0,this.isFetchingAlternatives=!1}}this.availableSources.length>1&&(this.currentSourceIndex=(this.currentSourceIndex+1)%this.availableSources.length,this.lyrics=this.availableSources[this.currentSourceIndex].lines,this.lyricsSource=this.availableSources[this.currentSourceIndex].source,await this.onLyricsLoaded())}}async resolveSongMetadata(){var h,y,p,u,v,m,g;const t={title:((h=this.songTitle)==null?void 0:h.trim())??"",artist:((y=this.songArtist)==null?void 0:y.trim())??"",album:((p=this.songAlbum)==null?void 0:p.trim())||void 0,durationMs:void 0};typeof this.songDurationMs=="number"&&this.songDurationMs>0?t.durationMs=this.songDurationMs:typeof this.duration=="number"&&this.duration>0&&(t.durationMs=this.duration);const e=null;let i=this.musicId,s;if(this.query&&(!t.title||!t.artist||!t.album)){const x=f.parseQueryMetadata(this.query);x&&(!t.title&&x.title&&(t.title=x.title),!t.artist&&x.artist&&(t.artist=x.artist),!t.album&&x.album&&(t.album=x.album))}let r=null;this.query&&(!t.title||!t.artist)&&(r=await f.searchLyricsPlusCatalog(this.query),r&&(!t.title&&r.title&&(t.title=r.title),!t.artist&&r.artist&&(t.artist=r.artist),!t.album&&r.album&&(t.album=r.album),t.durationMs==null&&typeof r.durationMs=="number"&&r.durationMs>0&&(t.durationMs=r.durationMs),!i&&((u=r.id)!=null&&u.appleMusic)&&(i=r.id.appleMusic),!s&&r.isrc&&(s=r.isrc)));const n=((v=t.title)==null?void 0:v.trim())??"",a=((m=t.artist)==null?void 0:m.trim())??"",o=(g=t.album)==null?void 0:g.trim(),l=typeof t.durationMs=="number"&&Number.isFinite(t.durationMs)&&t.durationMs>0?Math.round(t.durationMs):void 0;return{metadata:n&&a?{title:n,artist:a,album:o||void 0,durationMs:l}:void 0,appleId:i,appleSong:e,catalogIsrc:s}}static parseQueryMetadata(t){const e=t==null?void 0:t.trim();if(!e)return null;const i={},s=e.split(/\s[-–—]\s/);if(s.length>=2){const[n,...a]=s,o=a.join(" - "),l=n.trim(),d=o.trim();if(l&&d)return i.title=l,i.artist=d,i}const r=e.split(/\s+[bB]y\s+/);if(r.length===2){const[n,a]=r.map(o=>o.trim());if(n&&a)return i.title=n,i.artist=a,i}return null}static async searchLyricsPlusCatalog(t){const e=t==null?void 0:t.trim();if(!e)return null;for(const i of se){const r=`${i.endsWith("/")?i.slice(0,-1):i}/v1/songlist/search?q=${encodeURIComponent(e)}`;try{const n=await fetch(r);if(n.ok){const a=await n.json();let o=[];const l=a;if(Array.isArray(l==null?void 0:l.results)?o=l.results:Array.isArray(a)&&(o=a),o.length>0)return o.find(h=>(h==null?void 0:h.id)&&h.id.appleMusic)??o[0]}}catch{}}return null}static async fetchLyricsFromYouLyPlus(t,e,i={}){var l,d,h,y;if(!t||!e)return[];const s=new URLSearchParams({title:t,artist:e});i.album&&s.append("album",i.album),i.durationMs&&i.durationMs>0&&s.append("duration",Math.round(i.durationMs/1e3).toString()),s.append("source",We);const r=(p,u)=>{const v=p.toLowerCase(),m=u.some(b=>b.text&&Array.isArray(b.text)&&b.text.length>1),g=u.length>0&&u.every(b=>b.timestamp===0&&b.endtime===0),x=v.includes("qq")||v.includes("lyricsplus");return v.includes("apple")&&m?1:x&&m?2:v.includes("musixmatch")&&m?3:v.includes("apple")&&!m&&!g?4:x&&!m&&!g?5:v.includes("musixmatch")&&!m&&!g?6:v.includes("apple")&&g?7:x&&g?8:v.includes("musixmatch")&&g?9:10},n=[],a=[...se].sort(()=>Math.random()-.5).slice(0,2);for(const p of a){const v=`${p.endsWith("/")?p.slice(0,-1):p}/v2/lyrics/get?${s.toString()}`;let m=null;try{const g=await fetch(v);g.ok&&(m=await g.json())}catch{m=null}if(m){const g=f.convertKPoeLyrics(m);if(g&&g.length>0){const x=((l=m==null?void 0:m.metadata)==null?void 0:l.source)||((d=m==null?void 0:m.metadata)==null?void 0:d.provider)||"LyricsPlus (KPoe)",b=r(x,g),T={lines:g,source:x};if(n.push(T),b===1)break}}}if(!n.some(p=>r(p.source,p.lines)<=2))try{const p=new URLSearchParams(s);p.set("source","qq");const u=`https://lyricsplus.binimum.org/v2/lyrics/get?${p.toString()}`,v=await fetch(u);if(v.ok){const m=await v.json();if(m){const g=f.convertKPoeLyrics(m),x=((h=m==null?void 0:m.metadata)==null?void 0:h.source)||((y=m==null?void 0:m.metadata)==null?void 0:y.provider)||"LyricsPlus (KPoe)";g&&g.length>0&&n.push({lines:g,source:x})}}}catch{}return n}static parseLrcSubtitles(t){if(!t||typeof t!="string")return[];const e=[],i=t.split(`
`),s=[];for(const r of i){const n=r.match(/^\[(\d{1,3}):(\d{2})\.(\d{2,3})\]\s?(.*)$/);if(!n)continue;const a=parseInt(n[1],10),o=parseInt(n[2],10);let l=parseInt(n[3],10);n[3].length===3&&(l=Math.round(l/10));const d=(a*60+o)*1e3+l*10,h=n[4]||"";s.push({timestamp:d,text:h})}for(let r=0;r<s.length;r+=1){const{timestamp:n,text:a}=s[r],o=r+1<s.length?s[r+1].timestamp:n+5e3;if(!a.trim())continue;const l={text:a,part:!1,timestamp:n,endtime:o,lineSynced:!0};e.push({text:[l],background:!1,backgroundText:[],oppositeTurn:!1,timestamp:n,endtime:o,isWordSynced:!1})}return e}static async fetchLyricsFromTidal(t,e){var a,o,l,d,h;const i=(a=t.title)==null?void 0:a.trim(),s=(o=t.artist)==null?void 0:o.trim();if(!i||!s)return null;const n=[...Ue].sort(()=>Math.random()-.5).slice(0,2);for(const y of n)try{const p=y.endsWith("/")?y.slice(0,-1):y,u=`${i} ${s}`,v=new URLSearchParams({s:u}),m=await fetch(`${p}/search/?${v.toString()}`);if(!m.ok)continue;const g=await m.json(),x=(l=g==null?void 0:g.data)==null?void 0:l.items;if(!Array.isArray(x)||x.length===0)continue;let b=x[0];if(e){const k=x.find($=>$.isrc&&$.isrc.toLowerCase()===e.toLowerCase());k&&(b=k)}const T=b==null?void 0:b.id;if(!T)continue;const I=await fetch(`${p}/lyrics/?id=${T}`);if(!I.ok)continue;const L=await I.json(),A=(d=L==null?void 0:L.lyrics)==null?void 0:d.subtitles;if(A&&typeof A=="string"){const k=f.parseLrcSubtitles(A);if(k.length>0){const $=((h=L==null?void 0:L.lyrics)==null?void 0:h.lyricsProvider)||"Tidal";return{lines:k,source:`Tidal (${$})`}}}}catch{}return null}static async fetchLyricsFromLrclib(t){var s,r;const e=(s=t.title)==null?void 0:s.trim(),i=(r=t.artist)==null?void 0:r.trim();if(!e||!i)return null;try{const n=`${e} ${i}`,a=new URLSearchParams({q:n}),o=await fetch(`https://lrclib.net/api/search?${a.toString()}`,{headers:{"User-Agent":`apple-music-web-components/${ie}`}});if(!o.ok)return null;const l=await o.json();if(!Array.isArray(l)||l.length===0)return null;const h=l.find(y=>y.syncedLyrics&&typeof y.syncedLyrics=="string")||l[0];if(h.syncedLyrics){const y=f.parseLrcSubtitles(h.syncedLyrics);if(y.length>0)return{lines:y,source:"LRCLIB"}}if(h.plainLyrics&&typeof h.plainLyrics=="string"){const y=h.plainLyrics.split(`
`).filter(p=>p.trim());if(y.length>0)return{lines:y.map(u=>({text:[{text:u,part:!1,timestamp:0,endtime:0}],background:!1,backgroundText:[],oppositeTurn:!1,timestamp:0,endtime:0,isWordSynced:!1})),source:"LRCLIB (unsynced)"}}}catch{}return null}static convertKPoeLyrics(t){var l,d,h,y,p;if(!t)return null;let e=null;if(Array.isArray(t==null?void 0:t.lyrics)?e=t.lyrics:Array.isArray((l=t==null?void 0:t.data)==null?void 0:l.lyrics)?e=t.data.lyrics:Array.isArray(t==null?void 0:t.data)&&(e=t.data),!e||e.length===0)return null;const i=e.filter(u=>!!u),s=[],r=t.type==="Line"||t.type==="line",n=((d=t.metadata)==null?void 0:d.agents)??{},a=Object.entries(n),o={};if(a.length>0){a.sort((m,g)=>m[0].localeCompare(g[0]));const u=a.filter(([m,g])=>g.type==="person"),v=new Map;u.forEach(([m],g)=>{v.set(m,g)}),a.forEach(([m,g])=>{const x=g.alias||m;if(g.type==="group")o[x]="start";else if(g.type==="other")o[x]="end";else if(g.type==="person"){const b=v.get(m);b!==void 0&&(o[x]=b%2===0?"start":"end")}})}for(const u of i){const v=f.toMilliseconds(u.time),m=f.toMilliseconds(u.duration);let g;const x=(h=u.element)==null?void 0:h.singer;x&&o[x]&&(g=o[x]);const b=typeof u.text=="string"?u.text:"",T=f.toMilliseconds(u.time),I=f.toMilliseconds(u.duration),A=f.toMilliseconds(u.endTime)||T+(I||0),k=Array.isArray(u.syllabus)?u.syllabus.filter(S=>!!S):[],$=[],O=[];if(!r&&k.length>0)for(const S of k){const z=f.toMilliseconds(S.time,T),B=f.toMilliseconds(S.duration),N=B===0&&k.length===1?A:z+B,R={text:typeof S.text=="string"?S.text:"",part:!!S.part,timestamp:z,endtime:N};S.isBackground?O.push(R):$.push(R)}$.length===0&&b&&$.push({text:b,part:!1,timestamp:T,endtime:A||T,lineSynced:r});const yt=$.length>0||O.length>0,{transliteration:w}=u;let P;w&&(P=w.text,Array.isArray(w.syllabus)&&w.syllabus.length===$.length&&w.syllabus.forEach((S,z)=>{$[z]&&($[z].romanizedText=S.text)}));const _=(y=u.translation)==null?void 0:y.text,D={text:$,background:O.length>0,backgroundText:O,oppositeTurn:Array.isArray(u.element)?u.element.includes("opposite")||u.element.includes("right"):!1,timestamp:T,endtime:v+m,isWordSynced:r?!1:yt,alignment:g,songPart:(p=u.element)==null?void 0:p.songPart,romanizedText:P,translation:_};s.push(D)}return s}static toMilliseconds(t,e=0){const i=Number(t);return!Number.isFinite(i)||Number.isNaN(i)?e:Number.isInteger(i)?Math.max(0,Math.round(i)):Math.round(i*1e3)}firstUpdated(){this.lyricsContainer&&(this.lyricsContainer.addEventListener("wheel",this.handleUserScroll.bind(this),{passive:!0}),this.lyricsContainer.addEventListener("touchmove",this.handleUserScroll.bind(this),{passive:!0}))}_onTimeChanged(t,e){const i=Math.abs(e-t),s=this.findActiveLineIndices(e),r=this.activeLineIndices,n=!f.arraysEqual(s,r);if(n||i>.5){if(this.lyricsContainer){for(const a of r)if(!s.includes(a)){const o=this.lyricsContainer.querySelector(`#lyrics-line-${a}`);o&&(o.classList.remove("active"),f.resetSyllables(o))}for(const a of s)if(!r.includes(a)){const o=this.lyricsContainer.querySelector(`#lyrics-line-${a}`);o&&(o.classList.add("active"),o.classList.remove("pre-active"))}}if(this.startAnimationFromTime(e),this.lyricsContainer&&this.activeLineIndices.length>0){const a=this.activeLineIndices[0],o=this.lyricsContainer.querySelector(`#lyrics-line-${a}`);o&&o!==this.currentPrimaryActiveLine&&(this.lastPrimaryActiveLine=this.currentPrimaryActiveLine,this.currentPrimaryActiveLine=o,this.updatePositionClasses(o))}this._handleActiveLineScroll(r)}if(this.lyricsContainer){for(const d of this.activeLineIndices){const h=this.lyricsContainer.querySelector(`#lyrics-line-${d}`);h&&f.updateSyllablesForLine(h,e)}this.lyricsContainer.querySelectorAll(".lyrics-gap.active").forEach(d=>{f.updateSyllablesForLine(d,e)}),this.lyricsContainer.querySelectorAll(".lyrics-gap").forEach(d=>{const h=parseFloat(d.getAttribute("data-start-time")||"0"),y=parseFloat(d.getAttribute("data-end-time")||"0"),p=e>=h&&e<y,u=d.classList.contains("active"),v=d.classList.contains("gap-exiting"),m=600,g=u&&!v&&e>=y-m;p&&!u&&!v?(d.classList.remove("gap-exiting"),d.classList.add("active"),d.querySelectorAll(".lyrics-syllable").forEach(b=>{const T=parseFloat(b.getAttribute("data-end-time")||"0");e>T&&b.classList.add("finished")})):g?(d.classList.add("gap-exiting"),d.classList.remove("active"),setTimeout(()=>{d.classList.remove("gap-exiting")},800)):u&&!p?(d.classList.remove("active"),d.classList.remove("gap-exiting")):v&&e<y-m&&d.classList.remove("gap-exiting")});const l=this.findInstrumentalGapAt(e);if(l?this.lastInstrumentalIndex=l.insertBeforeIndex:this.lastInstrumentalIndex!==null&&(this.lastInstrumentalIndex=null),!n&&this.activeLineIndices.length>0){const d=this.activeLineIndices[0],h=this.lyricsContainer.querySelector(`#lyrics-line-${d}`);h&&h!==this.currentPrimaryActiveLine&&(this.lastPrimaryActiveLine=this.currentPrimaryActiveLine,this.currentPrimaryActiveLine=h,this.updatePositionClasses(h))}if(this.autoScroll&&!this.isUserScrolling&&!this.isClickSeeking&&this.lyrics&&this.activeLineIndices.length===0)for(let h=0;h<this.lyrics.length;h+=1){const p=this.lyrics[h].timestamp-e,u=this.lyricsContainer.querySelector(`#lyrics-line-${h}`);if(p>0&&p<=500){u&&(u.classList.add("pre-active"),u!==this.currentPrimaryActiveLine&&this.scrollToActiveLineYouLy(u));break}else u&&u.classList.remove("pre-active")}}}updated(t){if(t.has("lyrics")&&(this._updateCharTimingData(),this.lyricsContainer&&this.lyrics)){const e=this.findActiveLineIndices(this.currentTime);for(const i of e){const s=this.lyricsContainer.querySelector(`#lyrics-line-${i}`);s&&s.classList.add("active")}}if(t.has("duration")&&this.duration===-1){this.currentTime=0,this.activeLineIndices=[],this.activeMainWordIndices.clear(),this.activeBackgroundWordIndices.clear(),this.mainWordProgress.clear(),this.backgroundWordProgress.clear(),this.mainWordAnimations.clear(),this.backgroundWordAnimations.clear(),this.isUserScrolling=!1,this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=void 0),this.userScrollTimeoutId&&(clearTimeout(this.userScrollTimeoutId),this.userScrollTimeoutId=void 0),this.lyricsContainer&&(this.lyricsContainer.scrollTop=0);return}(t.has("query")||t.has("musicId")||t.has("isrc")||t.has("songTitle")||t.has("songArtist")||t.has("songAlbum")||t.has("songDurationMs"))&&!t.has("currentTime")&&this.fetchLyrics(),t.has("currentTime")&&this.lyrics}_handleActiveLineScroll(t){var r;if(!this.autoScroll||this.isUserScrolling||this.isClickSeeking||this.activeLineIndices.length===0)return;const e=this.activeLineIndices.filter(n=>!t.includes(n));if(e.length===0)return;const i=e[e.length-1],s=(r=this.lyricsContainer)==null?void 0:r.querySelector(`#lyrics-line-${i}`);s?this.scrollToActiveLineYouLy(s):this.currentPrimaryActiveLine?this.scrollToActiveLineYouLy(this.currentPrimaryActiveLine):this.scrollToActiveLine()}_getTextWidth(t,e){return this._textWidthCanvas||(this._textWidthCanvas=document.createElement("canvas"),this._textWidthCtx=this._textWidthCanvas.getContext("2d",{willReadFrequently:!0})),this._textWidthCtx?(this._textWidthCtx.font=e,this._textWidthCtx.measureText(t).width):0}_updateCharTimingData(){if(!this.shadowRoot)return;const t=this.shadowRoot.querySelector(".lyrics-syllable");if(!t)return;const e=getComputedStyle(t),{font:i}=e,s=parseFloat(e.fontSize),r=this.shadowRoot.querySelectorAll(".lyrics-word.growable");r&&r.forEach(n=>{const a=n.querySelectorAll(".lyrics-syllable-wrap"),o=[];a.forEach(l=>{const d=l.querySelector(".lyrics-syllable");d&&o.push(d)}),o.forEach(l=>{const d=l.querySelectorAll(".char");if(d.length===0)return;const y=Array.from(d).map(b=>b.textContent||"").map(b=>this._getTextWidth(b,i)),p=y.reduce((b,T)=>b+T,0),u=parseFloat(l.dataset.duration||"0"),v=u>0?p/u:0,m=.375*s,g=v>0?m/v:100;let x=0;d.forEach((b,T)=>{const I=y[T],L=b;if(p>0){const A=x/p,k=I/p;L.dataset.wipeStart=A.toFixed(4),L.dataset.wipeDuration=k.toFixed(4),L.dataset.preWipeArrival=(u*A).toFixed(2),L.dataset.preWipeDuration=g.toFixed(2)}x+=I})})})}static arraysEqual(t,e){return t.length===e.length&&t.every((i,s)=>i===e[s])}handleUserScroll(){var t;this.isProgrammaticScroll||this.isClickSeeking||(this.isUserScrolling=!0,(t=this.lyricsContainer)==null||t.classList.add("user-scrolling"),this.userScrollTimeoutId&&clearTimeout(this.userScrollTimeoutId),this.userScrollTimeoutId=window.setTimeout(()=>{this.isUserScrolling=!1,this.userScrollTimeoutId=void 0,this.activeLineIndices.length>0&&this.scrollToActiveLine()},2e3))}findActiveLineIndices(t){if(!this.lyrics)return[];const e=[];for(let i=0;i<this.lyrics.length;i+=1){const s=this.lyrics[i];let r=s.endtime;if(i<this.lyrics.length-1){const n=this.lyrics[i+1].timestamp;n-s.endtime<lt&&r<n&&(r=Math.max(r,n-500))}t>=s.timestamp&&t<=r&&e.push(i)}return e}findInstrumentalGapAt(t){if(!this.lyrics||this.lyrics.length===0)return null;const e=this.lyrics[0];if(t>=0&&t<e.timestamp){const s=e.timestamp;return s-0>=lt?{insertBeforeIndex:0,gapStart:0,gapEnd:s}:null}for(let i=0;i<this.lyrics.length-1;i+=1){const s=this.lyrics[i],r=this.lyrics[i+1],n=s.endtime,a=r.timestamp;if(t>n&&t<a)return a-n>=lt?{insertBeforeIndex:i+1,gapStart:n,gapEnd:a}:null}return null}findAllInstrumentalGaps(){if(!this.lyrics||this.lyrics.length===0)return[];const t=[],e=this.lyrics[0];e.timestamp>=lt&&t.push({insertBeforeIndex:0,gapStart:0,gapEnd:e.timestamp});for(let i=0;i<this.lyrics.length-1;i+=1){const s=this.lyrics[i],r=this.lyrics[i+1],n=s.endtime,a=r.timestamp;a-n>=lt&&t.push({insertBeforeIndex:i+1,gapStart:n,gapEnd:a})}return t}startAnimationFromTime(t){if(this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=void 0),!this.lyrics)return;const e=this.findActiveLineIndices(t);if(f.arraysEqual(e,this.activeLineIndices)||(this.activeLineIndices=e),this.activeMainWordIndices.clear(),this.activeBackgroundWordIndices.clear(),this.mainWordAnimations.clear(),this.backgroundWordAnimations.clear(),this.mainWordProgress.clear(),this.backgroundWordProgress.clear(),e.length!==0){for(const i of e){const s=this.lyrics[i];let r=-1;for(let a=0;a<s.text.length;a+=1)if(t>=s.text[a].timestamp&&t<=s.text[a].endtime){r=a;break}this.activeMainWordIndices.set(i,r);let n=-1;if(s.backgroundText){for(let a=0;a<s.backgroundText.length;a+=1)if(t>=s.backgroundText[a].timestamp&&t<=s.backgroundText[a].endtime){n=a;break}}this.activeBackgroundWordIndices.set(i,n)}this.setupAnimations(),this.interpolate&&this.animateProgress()}}updateActiveLineAndWords(){if(!this.lyrics)return;const t=this.findActiveLineIndices(this.currentTime);f.arraysEqual(t,this.activeLineIndices)||(this.activeLineIndices=t),this.activeMainWordIndices.clear(),this.activeBackgroundWordIndices.clear();for(const e of t){const i=this.lyrics[e];let s=-1;for(let n=0;n<i.text.length;n+=1)if(this.currentTime>=i.text[n].timestamp&&this.currentTime<=i.text[n].endtime){s=n;break}this.activeMainWordIndices.set(e,s);let r=-1;if(i.backgroundText){for(let n=0;n<i.backgroundText.length;n+=1)if(this.currentTime>=i.backgroundText[n].timestamp&&this.currentTime<=i.backgroundText[n].endtime){r=n;break}}this.activeBackgroundWordIndices.set(e,r)}}setupAnimations(){if(this.activeLineIndices.length===0||!this.lyrics){this.mainWordAnimations.clear(),this.backgroundWordAnimations.clear();return}for(const t of this.activeLineIndices){const e=this.lyrics[t],i=this.activeMainWordIndices.get(t)??-1,s=this.activeBackgroundWordIndices.get(t)??-1;if(i!==-1){const r=e.text[i],n=r.endtime-r.timestamp,a=this.currentTime-r.timestamp;this.mainWordAnimations.set(t,{startTime:performance.now()-a,duration:n})}else this.mainWordAnimations.set(t,{startTime:0,duration:0});if(s!==-1&&e.backgroundText){const r=e.backgroundText[s],n=r.endtime-r.timestamp,a=this.currentTime-r.timestamp;this.backgroundWordAnimations.set(t,{startTime:performance.now()-a,duration:n})}else this.backgroundWordAnimations.set(t,{startTime:0,duration:0})}}handleLineClick(t){var s;this.lyricsContainer&&(this.lyricsContainer.querySelectorAll(".lyrics-line").forEach(n=>{f.resetSyllables(n),n.classList.remove("scroll-animate"),n.style.removeProperty("--scroll-delta"),n.style.removeProperty("--lyrics-line-delay")}),this.lyricsContainer.classList.remove("wheel-scrolling")),this.scrollAnimationState&&(this.scrollAnimationState.isAnimating=!1,this.scrollAnimationState.pendingUpdate=null),this.scrollUnlockTimeout&&(clearTimeout(this.scrollUnlockTimeout),this.scrollUnlockTimeout=void 0),this.scrollAnimationTimeout&&(clearTimeout(this.scrollAnimationTimeout),this.scrollAnimationTimeout=void 0),this.userScrollTimeoutId&&(clearTimeout(this.userScrollTimeoutId),this.userScrollTimeoutId=void 0),this.isUserScrolling=!1,this.currentPrimaryActiveLine=null,this.lastPrimaryActiveLine=null,this.activeLineIds.clear(),this.animatingLines=[];const e=(s=this.lyricsContainer)==null?void 0:s.querySelector(`.lyrics-line[data-start-time="${t.timestamp*1e3}"]`);e&&this.lyricsContainer&&(this.currentPrimaryActiveLine=e,this.currentScrollOffset=-this.lyricsContainer.scrollTop,this.isClickSeeking=!0,this.clickSeekTimeout&&clearTimeout(this.clickSeekTimeout),this.clickSeekTimeout=setTimeout(()=>{this.isClickSeeking=!1},800),this.scrollToActiveLineYouLy(e,!0));const i=new CustomEvent("line-click",{detail:{timestamp:t.timestamp},bubbles:!0,composed:!0});this.dispatchEvent(i)}static getBackgroundTextPlacement(t){if(!t.backgroundText||t.backgroundText.length===0||t.text.length===0)return"after";const e=t.text[0].timestamp;return t.backgroundText[0].timestamp<e?"before":"after"}scrollToActiveLine(){if(!this.lyricsContainer||this.activeLineIndices.length===0)return;const t=Math.min(...this.activeLineIndices),e=this.lyricsContainer.querySelector(`.lyrics-line:nth-child(${t+1})`);if(e){const i=this.lyricsContainer.clientHeight,s=e.offsetTop,r=e.clientHeight,n=e.querySelector(".background-text.before");let a=0;n&&(a=n.clientHeight/2);const o=s-i/2+r/2-a;requestAnimationFrame(()=>{var l;this.isProgrammaticScroll=!0,(l=this.lyricsContainer)==null||l.scrollTo({top:o,behavior:"smooth"}),setTimeout(()=>{this.isProgrammaticScroll=!1},100)})}}scrollToInstrumental(t){if(!this.lyricsContainer)return;const e=this.lyricsContainer.querySelector(`#gap-${t}`);if(e){const s=this.getScrollPaddingTop()-e.offsetTop;this.isProgrammaticScroll=!0,this.animateScrollYouLy(s,!1),setTimeout(()=>{this.isProgrammaticScroll=!1},250)}}getScrollPaddingTop(){if(!this.lyricsContainer)return 0;const e=getComputedStyle(this).getPropertyValue("--lyrics-scroll-padding-top")||"25%";return e.includes("%")?this.lyricsContainer.clientHeight*(parseFloat(e)/100):parseFloat(e)||0}animateScrollYouLy(t,e=!1){if(!this.lyricsContainer)return;const i=this.lyricsContainer;this.scrollAnimationState||(this.scrollAnimationState={isAnimating:!1,pendingUpdate:null},this.animatingLines=[]);const s=this.scrollAnimationState;if(s.isAnimating&&!e){s.pendingUpdate=t;return}this.scrollUnlockTimeout&&(clearTimeout(this.scrollUnlockTimeout),this.scrollUnlockTimeout=void 0),this.scrollAnimationTimeout&&(clearTimeout(this.scrollAnimationTimeout),this.scrollAnimationTimeout=void 0);const{animatingLines:r}=this,n=Math.max(0,-t),o=-i.scrollTop-t;if(this.currentScrollOffset=t,Math.abs(i.scrollTop-n)<1&&Math.abs(o)<1){s.isAnimating=!1,s.pendingUpdate=null;return}if(e){for(const A of r)A.classList.remove("scroll-animate"),A.style.removeProperty("--scroll-delta"),A.style.removeProperty("--lyrics-line-delay");r.length=0,i.scrollTo({top:n,behavior:"smooth"}),s.isAnimating=!1,s.pendingUpdate=null;return}for(const A of r)A.classList.remove("scroll-animate");r.length=0;const l=this.lyricsContainer.querySelectorAll(".lyrics-line"),d=Array.from(l),h=this.currentPrimaryActiveLine||this.lastPrimaryActiveLine||d[0];if(!h)return;const y=d.indexOf(h);if(y===-1)return;const p=30,u=10,v=15,m=d.length,g=Math.max(0,y-u),x=Math.min(m,y+v);let b=0,T=0;const I=[];for(let A=g;A<x;A+=1){const k=d[A];A>=y&&(T+=1);const $=A>=y?(T-1)*p:0;k.style.setProperty("--scroll-delta",`${o}px`),k.style.setProperty("--lyrics-line-delay",`${$}ms`),I.push(k);const O=400+$;O>b&&(b=O)}i.getBoundingClientRect();for(const A of I)A.classList.add("scroll-animate"),r.push(A);s.isAnimating=!0;const L=400;this.scrollUnlockTimeout=setTimeout(()=>{if(s.isAnimating=!1,s.pendingUpdate!==null){const A=s.pendingUpdate;s.pendingUpdate=null,this.animateScrollYouLy(A,!1)}},L),this.scrollAnimationTimeout=setTimeout(()=>{for(let A=0;A<r.length;A+=1){const k=r[A];k.classList.remove("scroll-animate"),k.style.removeProperty("--scroll-delta"),k.style.removeProperty("--lyrics-line-delay")}r.length=0,this.scrollAnimationTimeout=void 0},b+50),i.scrollTo({top:n,behavior:"instant"})}updatePositionClasses(t){if(!this.lyricsContainer)return;const e=["lyrics-activest","post-active-line","next-active-line","prev-1","prev-2","prev-3","prev-4","next-1","next-2","next-3","next-4"];this.lyricsContainer.querySelectorAll(`.${e.join(", .")}`).forEach(r=>r.classList.remove(...e)),t.classList.add("lyrics-activest");const i=Array.from(this.lyricsContainer.querySelectorAll(".lyrics-line")),s=i.indexOf(t);for(let r=Math.max(0,s-4);r<=Math.min(i.length-1,s+4);r+=1){const n=r-s;if(n!==0){const a=i[r];n===-1?a.classList.add("post-active-line"):n===1?a.classList.add("next-active-line"):n<0?a.classList.add(`prev-${Math.abs(n)}`):a.classList.add(`next-${n}`)}}}scrollToActiveLineYouLy(t,e=!1){if(!t||!this.lyricsContainer)return;const i=this.getScrollPaddingTop(),s=i-t.offsetTop,r=this.lyricsContainer.getBoundingClientRect().top;if(!(!e&&Math.abs(t.getBoundingClientRect().top-r-i)<1)){if(!e){const n=this.lyricsContainer;if(n.scrollTop+n.clientHeight>=n.scrollHeight-50)return}this.lyricsContainer.classList.remove("not-focused","user-scrolling"),this.isProgrammaticScroll=!0,this.isUserScrolling=!1,this.userScrollTimeoutId&&(clearTimeout(this.userScrollTimeoutId),this.userScrollTimeoutId=void 0),setTimeout(()=>{this.isProgrammaticScroll=!1},600),this.animateScrollYouLy(s,e)}}static updateSyllableAnimation(t){var v;if(t.classList.contains("highlight"))return;const{classList:e}=t,i=e.contains("rtl-text"),s=Array.from(t.querySelectorAll("span.char")),r=(v=t.parentElement)==null?void 0:v.parentElement,n=r?Array.from(r.querySelectorAll("span.char")):[],a=r==null?void 0:r.classList.contains("growable"),o=t.getAttribute("data-syllable-index")==="0",l=o,d=t.closest(".lyrics-gap")!==null,h=parseFloat(t.getAttribute("data-duration")||"0")||300,y=parseFloat(t.getAttribute("data-word-duration")||t.getAttribute("data-duration")||"0")||h,p=new Map,u=[];if(a&&o&&n.length>0){const m=y,g=m*.09,x=m*1.5;n.forEach(b=>{const T=parseFloat(b.dataset.horizontalOffset||"0"),I=parseFloat(b.dataset.syllableCharIndex||"0"),L=g*I,A=b.dataset.maxScale||"1.1",k=b.dataset.shadowIntensity||"0.6",$=b.dataset.translateYPeak||"-2";p.set(b,`grow-dynamic ${x}ms ease-in-out ${L}ms forwards`),u.push({element:b,property:"--char-offset-x",value:`${T}`}),u.push({element:b,property:"--max-scale",value:A}),u.push({element:b,property:"--shadow-intensity",value:k}),u.push({element:b,property:"--translate-y-peak",value:`${$}`})})}if(s.length>0)s.forEach((m,g)=>{const x=parseFloat(m.dataset.wipeStart||"0"),b=parseFloat(m.dataset.wipeDuration||"0"),T=h*x,I=h*b,L=l&&g===0;let A;L?A=i?"start-wipe-rtl":"start-wipe":A=i?"wipe-rtl":"wipe";const k=p.get(m)||m.style.animation||"",$=[];k&&k.includes("grow-dynamic")&&$.push(k.split(",")[0].trim()),I>0&&$.push(`${A} ${I}ms linear ${T}ms forwards`),p.set(m,$.join(", "))});else{const m=parseFloat(t.getAttribute("data-wipe-ratio")||"1"),g=h*m;let x;if(l?x=i?"start-wipe-rtl":"start-wipe":x=i?"wipe-rtl":"wipe",t.classList.contains("line-synced"))return;const T=`${d?"fade-gap":x} ${g}ms ${d?"ease-out":"linear"} forwards`;t.style.animation=T}e.remove("pre-highlight"),e.add("highlight");for(const[m,g]of p.entries())m.style.animation=g;for(const m of u)m.element.style.setProperty(m.property,m.value)}static resetSyllable(t){t&&(t.style.animation="",t.style.removeProperty("--pre-wipe-duration"),t.style.removeProperty("--pre-wipe-delay"),t.style.transition="none",t.style.backgroundColor="var(--lyplus-text-secondary)",t.querySelectorAll("span.char").forEach(e=>{const i=e;i.style.animation="",i.style.transition="none",i.style.backgroundColor="var(--lyplus-text-secondary)"}),t.classList.remove("highlight","finished","pre-highlight","cleanup"),requestAnimationFrame(()=>{t.style.removeProperty("background-color"),t.style.removeProperty("transition"),t.querySelectorAll("span.char").forEach(e=>{const i=e;i.style.removeProperty("background-color"),i.style.removeProperty("transition")})}))}static resetSyllables(t){t&&(t._cachedSyllableElements=null,Array.from(t.getElementsByClassName("lyrics-syllable")).forEach(e=>f.resetSyllable(e)))}static updateSyllablesForLine(t,e){let i=t._cachedSyllableElements;i||(i=Array.from(t.querySelectorAll(".lyrics-syllable")),t._cachedSyllableElements=i);for(let s=0;s<i.length;s+=1){const r=i[s],n=parseFloat(r.getAttribute("data-start-time")||"0"),a=parseFloat(r.getAttribute("data-end-time")||"0");if(n){const{classList:o}=r,l=o.contains("highlight"),d=o.contains("finished"),h=o.contains("pre-highlight"),y=l||d||h;if(!(e<n-1e3&&!y)){let p=!1;h&&s>0&&(i[s-1].classList.contains("highlight")||(o.remove("pre-highlight"),r.style.removeProperty("--pre-wipe-duration"),r.style.removeProperty("--pre-wipe-delay"),r.style.animation="",p=!0)),p||(e>=n&&e<=a?(l||f.updateSyllableAnimation(r),d&&o.remove("finished")):e>a?d||(l||f.updateSyllableAnimation(r),o.add("finished")):(l||d)&&f.resetSyllable(r))}}}}animateProgress(){const t=performance.now();let e=!1;if(!this.lyrics||this.activeLineIndices.length===0){this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=void 0);return}for(const i of this.activeLineIndices){const s=this.lyrics[i],r=this.mainWordAnimations.get(i);if(r&&r.duration>0){const a=t-r.startTime;if(a>=0){const o=Math.min(1,a/r.duration);if(this.mainWordProgress.set(i,o),o<1)e=!0;else{const l=this.activeMainWordIndices.get(i)??-1,d=l+1;if(l!==-1&&d<s.text.length){const h=s.text[l],y=s.text[d];this.activeMainWordIndices.set(i,d);const p=y.timestamp-h.endtime,u=y.endtime-y.timestamp;this.mainWordAnimations.set(i,{startTime:performance.now()+p,duration:u}),e=!0}else this.mainWordAnimations.set(i,{startTime:0,duration:0})}}else this.mainWordProgress.set(i,0),e=!0}const n=this.backgroundWordAnimations.get(i);if(n&&n.duration>0){const a=t-n.startTime;if(a>=0){const o=Math.min(1,a/n.duration);if(this.backgroundWordProgress.set(i,o),o<1)e=!0;else{const l=this.activeBackgroundWordIndices.get(i)??-1;if(s.backgroundText&&l!==-1&&l<s.backgroundText.length-1){const d=l+1,h=s.backgroundText[l],y=s.backgroundText[d];this.activeBackgroundWordIndices.set(i,d);const p=y.timestamp-h.endtime,u=y.endtime-y.timestamp;this.backgroundWordAnimations.set(i,{startTime:performance.now()+p,duration:u}),e=!0}else this.backgroundWordAnimations.set(i,{startTime:0,duration:0})}}else this.backgroundWordProgress.set(i,0),e=!0}}e?this.animationFrameId=requestAnimationFrame(this.animateProgress.bind(this)):this.animationFrameId&&(cancelAnimationFrame(this.animationFrameId),this.animationFrameId=void 0)}generateLRC(){if(!this.lyrics)return"";let t="";this.songTitle&&(t+=`[ti:${this.songTitle}]
`),this.songArtist&&(t+=`[ar:${this.songArtist}]
`),this.songAlbum&&(t+=`[al:${this.songAlbum}]
`),this.lyricsSource&&(t+=`[re:${this.lyricsSource}]
`);for(const e of this.lyrics)if(e.text&&e.text.length>0){const i=f.formatTimestampLRC(e.timestamp),s=e.text.map(r=>r.text).join("").trim();t+=`[${i}]${s}
`}return t}generateTTML(){if(!this.lyrics)return"";let t=`<?xml version="1.0" encoding="UTF-8"?>
`;t+=`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyrics">
`,t+=`  <body>
`;let e;for(let i=0;i<this.lyrics.length;i+=1){const s=this.lyrics[i],r=s.songPart;(r!==e||i===0)&&(i>0&&(t+=`    </div>
`),e=r,e?t+=`    <div itunes:song-part="${e}">
`:t+=`    <div>
`);const n=f.formatTimestampTTML(s.timestamp),a=f.formatTimestampTTML(s.endtime);t+=`      <p begin="${n}" end="${a}">
`;for(const o of s.text){const l=f.formatTimestampTTML(o.timestamp),d=f.formatTimestampTTML(o.endtime),h=o.text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");t+=`        <span begin="${l}" end="${d}">${h}</span>
`}t+=`      </p>
`}return this.lyrics.length>0&&(t+=`    </div>
`),t+=`  </body>
`,t+="</tt>",t}static formatTimestampLRC(t){const e=t/1e3,i=Math.floor(e/60),s=Math.floor(e%60),r=Math.floor(t%1e3/10),n=a=>a.toString().padStart(2,"0");return`${n(i)}:${n(s)}.${n(r)}`}static formatTimestampTTML(t){const e=t/1e3,i=Math.floor(e/3600),s=Math.floor(e%3600/60),r=Math.floor(e%60),n=Math.floor(t%1e3),a=(o,l=2)=>o.toString().padStart(l,"0");return`${a(i)}:${a(s)}:${a(r)}.${a(n,3)}`}downloadLyrics(){if(!this.lyrics||this.lyrics.length===0)return;const t=this.lyrics.some(l=>l.isWordSynced!==!1);let e="",i=this.downloadFormat;i==="auto"&&(i=t?"ttml":"lrc");let s="";if(i==="ttml"?(e=this.generateTTML(),s="application/xml"):(e=this.generateLRC(),s="text/plain"),!e)return;const r=new Blob([e],{type:s}),n=URL.createObjectURL(r),a=document.createElement("a");a.href=n;const o=this.songTitle?`${this.songTitle}${this.songArtist?` - ${this.songArtist}`:""}.${i}`:`lyrics.${i}`;a.download=o,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(n)}render(){this.fontFamily&&(this.style.fontFamily=this.fontFamily),this.style.setProperty("--hover-background-color",this.hoverBackgroundColor),this.style.setProperty("--highlight-color",this.highlightColor);const t=this.lyricsSource??"Unavailable",e=this.lyrics&&this.lyrics.length>0?this.lyrics.every(s=>s.timestamp===0&&s.endtime===0):!1,i=()=>{if(this.isLoading)return M`
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        `;if(!this.lyrics||this.lyrics.length===0)return M`<div class="no-lyrics">No lyrics found.</div>`;const s=this.findAllInstrumentalGaps(),r=new Map(s.map(n=>[n.insertBeforeIndex,n]));return this.lyrics.map((n,a)=>{var O,yt;const o=`lyrics-line-${a}`,l=((O=n.text[0])==null?void 0:O.timestamp)||0,d=((yt=n.text[n.text.length-1])==null?void 0:yt.endtime)||0,y=n.backgroundText&&n.backgroundText.length>0?M`<p class="background-vocal-container">
              ${n.backgroundText.map((w,P)=>{const _=w.timestamp,D=w.endtime,S=D-_,z=this.showRomanization&&w.romanizedText&&w.romanizedText.trim()!==w.text.trim()?M`<span
                        class="lyrics-syllable transliteration ${w.lineSynced?"line-synced":""}"
                        data-start-time="${_}"
                        data-end-time="${D}"
                        data-duration="${S}"
                        data-syllable-index="0"
                        data-wipe-ratio="1"
                        >${w.romanizedText}</span
                      >`:"";return M`<span class="lyrics-word">
                  <span class="lyrics-syllable-wrap">
                    <span
                      class="lyrics-syllable ${w.lineSynced?"line-synced":""}"
                      data-start-time="${_}"
                      data-end-time="${D}"
                      data-duration="${S}"
                      data-syllable-index="${P}"
                      >${w.text}</span
                    >
                    ${z}
                  </span>
                </span>`})}
            </p>`:"",p=[];for(const w of n.text)w.part&&p.length>0?p[p.length-1].push(w):p.push([w]);const u=new Array(p.length).fill(!1),v=new Array(p.length).fill(""),m=new Array(p.length).fill(0),g=new Array(p.length).fill(0),x=new Array(p.length).fill(0),b=new Array(p.length).fill(0);{let w=0;for(;w<p.length;){let P=w;for(;P<p.length-1;){const C=p[P],q=C[C.length-1].text;if(/\s$/.test(q))break;P+=1}const _=p.slice(w,P+1).flatMap(C=>C.map(q=>q.text)).join("").trim(),D=p[w][0].timestamp,S=p[P],z=S[S.length-1].endtime,B=z-D,N=/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(_),R=/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(_),tt=_.includes("-"),rt=!N&&!R&&!tt&&_.length<=7&&_.length>0&&B>=900&&B>=_.length*300&&(_.length>=4||B/_.length>=600);let W=0;for(let C=w;C<=P;C+=1){u[C]=rt,v[C]=_,m[C]=B,g[C]=W,x[C]=D,b[C]=z;const q=p[C].map(H=>H.text).join("");W+=q.replace(/\s/g,"").length}w=P+1}}const T=M`<p class="main-vocal-container">
          ${p.map((w,P)=>{const _=u[P];if(_&&g[P]>0)return"";const D=w.some(S=>S.lineSynced);if(_&&v[P].length>0){const S=v[P],z=m[P],B=x[P],N=b[P],R=S.length;let tt="";for(let W=P;W<p.length&&!(W>P&&g[W]===0||W>P&&!u[W]);W+=1)tt+=p[W].map(C=>C.text).join("");const rt=M`${tt.split("").map((W,C)=>{if(W===" ")return" ";const q=C/R,H=1e3,qt=Math.min(1,Math.max(0,(z-H)/(5e3-H)))**3,Tt=R>5,gt=z<1500;let at=0;if(Tt||gt){let xt=0;Tt&&(xt+=Math.min((R-5)/3,1)*.4),gt&&(xt+=Math.max(0,1-(z-1e3)/500)*.4),at=Math.min(xt,.85)}const bt=1-(R>1?C/(R-1):0)*at,Et=qt*bt,et=1+(R<=3?.07:.05)+Et*.1,Nt=.4+Et*.4,Ct=-((et-1)/.13)*6,It=((C+.5)/R-.5)*2*((et-1)*25);return M`<span
                    class="char"
                    data-char-index="${C}"
                    data-syllable-char-index="${C}"
                    data-wipe-start="${q.toFixed(4)}"
                    data-wipe-duration="${(1/R).toFixed(4)}"
                    data-horizontal-offset="${It.toFixed(2)}"
                    data-max-scale="${et.toFixed(3)}"
                    data-shadow-intensity="${Nt.toFixed(3)}"
                    data-translate-y-peak="${Ct.toFixed(3)}"
                    >${W}</span
                  >`})}`;return M`<span class="lyrics-word growable">
                <span class="lyrics-syllable-wrap">
                  <span
                    class="lyrics-syllable ${D?"line-synced":""}"
                    data-start-time="${B}"
                    data-end-time="${N}"
                    data-duration="${z}"
                    data-syllable-index="0"
                    data-wipe-ratio="1"
                    >${rt}</span
                  >
                </span>
              </span>`}if(w.length===1){const S=w[0],z=S.timestamp,B=S.endtime,N=B-z,R=S.text||"",tt=R.trim(),rt=this.showRomanization&&S.romanizedText&&S.romanizedText.trim()!==S.text.trim()?M`<span
                      class="lyrics-syllable transliteration ${S.lineSynced?"line-synced":""}"
                      data-start-time="${z}"
                      data-end-time="${B}"
                      data-duration="${N}"
                      data-syllable-index="0"
                      data-wipe-ratio="1"
                      >${S.romanizedText}</span
                    >`:"",W=_?M`${R.split("").map((C,q)=>{if(C===" ")return" ";const H=tt.length,Bt=q/R.length,kt=1e3,gt=Math.min(1,Math.max(0,(N-kt)/(5e3-kt)))**3,at=H>5,Lt=N<1500;let bt=0;if(at||Lt){let Mt=0;at&&(Mt+=Math.min((H-5)/3,1)*.4),Lt&&(Mt+=Math.max(0,1-(N-1e3)/500)*.4),bt=Math.min(Mt,.85)}const Dt=1-(H>1?q/(H-1):0)*bt,et=gt*Dt,vt=1+(H<=3?.07:.05)+et*.1,Ct=.4+et*.4,It=-((vt-1)/.13)*6,pe=((q+.5)/H-.5)*2*((vt-1)*25);return M`<span
                      class="char"
                      data-char-index="${q}"
                      data-syllable-char-index="${q}"
                      data-wipe-start="${Bt.toFixed(4)}"
                      data-wipe-duration="${(1/R.length).toFixed(4)}"
                      data-horizontal-offset="${pe.toFixed(2)}"
                      data-max-scale="${vt.toFixed(3)}"
                      data-shadow-intensity="${Ct.toFixed(3)}"
                      data-translate-y-peak="${It.toFixed(3)}"
                      >${C}</span
                    >`})}`:R;return M`<span
                class="lyrics-word ${_?"growable":""}"
              >
                <span class="lyrics-syllable-wrap">
                  <span
                    class="lyrics-syllable ${S.lineSynced?"line-synced":""}"
                    data-start-time="${z}"
                    data-end-time="${B}"
                    data-duration="${N}"
                    data-syllable-index="0"
                    data-wipe-ratio="1"
                    >${W}</span
                  >
                  ${rt}
                </span>
              </span>`}return M`<span
              class="lyrics-word ${_?"growable":""} allow-break"
            >
              ${w.map((S,z)=>M`
                  <span class="lyrics-syllable-wrap">
                    <span
                      class="lyrics-syllable ${D?"line-synced":""}"
                      data-start-time="${S.timestamp}"
                      data-end-time="${S.endtime}"
                      data-duration="${S.endtime-S.timestamp}"
                      data-syllable-index="${z}"
                      data-wipe-ratio="1"
                      >${S.text}</span
                    >
                    ${this.showRomanization&&S.romanizedText&&S.romanizedText.trim()!==S.text.trim()?M`<span
                          class="lyrics-syllable transliteration ${D?"line-synced":""}"
                          data-start-time="${S.timestamp}"
                          data-end-time="${S.endtime}"
                          data-duration="${S.endtime-S.timestamp}"
                          data-syllable-index="0"
                          data-wipe-ratio="1"
                          >${S.romanizedText}</span
                        >`:""}
                  </span>
                `)}
            </span>`})}
        </p>`,I=n.text.map(w=>w.text).join("").trim(),L=this.showTranslation&&n.translation&&n.translation.trim()!==I?M`<div class="lyrics-translation-container">
                ${n.translation}
              </div>`:"",A=this.showRomanization&&n.romanizedText&&!n.text.some(w=>w.romanizedText)&&n.romanizedText.trim()!==I?M`<div class="lyrics-romanization-container">
                ${n.romanizedText}
              </div>`:"";let k=null;const $=r.get(a);if($){const w=($.gapEnd-$.gapStart)/3;k=M`<div
            id="gap-${a}"
            class="lyrics-line lyrics-gap"
            data-start-time="${$.gapStart}"
            data-end-time="${$.gapEnd}"
          >
            <div class="lyrics-line-container">
              <p class="main-vocal-container">
                <span class="lyrics-word">
                  <span class="lyrics-syllable-wrap">
                    <span
                      class="lyrics-syllable"
                      data-start-time="${$.gapStart}"
                      data-end-time="${$.gapStart+w}"
                      data-duration="${w}"
                      data-wipe-ratio="1"
                      data-syllable-index="0"
                    ></span>
                  </span>
                  <span class="lyrics-syllable-wrap">
                    <span
                      class="lyrics-syllable"
                      data-start-time="${$.gapStart+w}"
                      data-end-time="${$.gapStart+w*2}"
                      data-duration="${w}"
                      data-wipe-ratio="1"
                      data-syllable-index="1"
                    ></span>
                  </span>
                  <span class="lyrics-syllable-wrap">
                    <span
                      class="lyrics-syllable"
                      data-start-time="${$.gapStart+w*2}"
                      data-end-time="${$.gapEnd}"
                      data-duration="${w}"
                      data-wipe-ratio="1"
                      data-syllable-index="2"
                    ></span>
                  </span>
                </span>
              </p>
            </div>
          </div>`}return M`
          ${k}
          <div
            id="${o}"
            class="lyrics-line ${n.alignment==="end"?"singer-right":"singer-left"}"
            data-start-time="${l}"
            data-end-time="${d}"
            @click=${()=>this.handleLineClick(n)}
            tabindex="0"
            @keydown=${w=>{(w.key==="Enter"||w.key===" ")&&this.handleLineClick(n)}}
          >
            <div class="lyrics-line-container">
              ${T} ${y}
              ${L} ${A}
            </div>
          </div>
        `})};return M`
      <div
        class="lyrics-container ${e?"is-unsynced":"blur-inactive-enabled"} ${this.isUserScrolling?"user-scrolling":""}"
      >
        ${!this.isLoading&&this.lyrics&&this.lyrics.length>0?M`
              <div class="lyrics-header">
                <div class="header-controls">
                  <button
                    class="download-button ${this.showRomanization?"active":""}"
                    @click=${this.toggleRomanization}
                    title="Toggle Romanization"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-speech-icon lucide-speech"
                    >
                      <path
                        d="M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20"
                      />
                      <path d="M19.8 17.8a7.5 7.5 0 0 0 .003-10.603" />
                      <path d="M17 15a3.5 3.5 0 0 0-.025-4.975" />
                    </svg>
                  </button>
                  <button
                    class="download-button ${this.showTranslation?"active":""}"
                    @click=${this.toggleTranslation}
                    title="Toggle Translation"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-languages-icon lucide-languages"
                    >
                      <path d="m5 8 6 6" />
                      <path d="m4 14 6-6 2-3" />
                      <path d="M2 5h12" />
                      <path d="M7 2h1" />
                      <path d="m22 22-5-10-5 10" />
                      <path d="M14 18h6" />
                    </svg>
                  </button>
                </div>
                <div class="download-controls">
                  <select
                    class="format-select"
                    @change=${s=>{this.downloadFormat=s.target.value}}
                    .value=${this.downloadFormat}
                    @click=${s=>s.stopPropagation()}
                  >
                    <option value="auto">Auto</option>
                    <option value="lrc">LRC</option>
                    <option value="ttml">TTML</option>
                  </select>
                  <button
                    class="download-button"
                    @click=${this.downloadLyrics}
                    title="Download Lyrics"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="lucide lucide-download-icon lucide-download"
                    >
                      <path d="M12 15V3" />
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="m7 10 5 5 5-5" />
                    </svg>
                  </button>
                </div>
              </div>
            `:""}
        ${i()}
        ${this.isLoading?"":M`
              <footer class="lyrics-footer">
                <div class="footer-content">
                  <span
                    class="source-info"
                    style="display: flex; align-items: center; gap: 8px;"
                  >
                    Source: ${t}
                    ${this.availableSources&&this.availableSources.length>1||!this.hasFetchedAllProviders?M`
                          <button
                            class="download-button"
                            title="Switch Lyrics Source"
                            style="font-family: inherit; font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.2); background: transparent; cursor: pointer; color: #aaa; display: inline-flex; align-items: center;"
                            @click=${this.switchSource}
                            ?disabled=${this.isFetchingAlternatives}
                          >
                            <svg
                              style="margin-right: 4px; ${this.isFetchingAlternatives?"animation: spin 1s linear infinite;":""}"
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="lucide lucide-arrow-down-up-icon lucide-arrow-down-up"
                            >
                              ${this.isFetchingAlternatives?te`<path
                                    d="M21 12a9 9 0 1 1-6.219-8.56"
                                  ></path>`:te`<path d="m3 16 4 4 4-4"></path
                                    ><path d="M7 20V4"></path
                                    ><path d="m21 8-4-4-4 4"></path
                                    ><path d="M17 4v16"></path>`}
                            </svg>
                            ${this.isFetchingAlternatives?"Switching...":"Switch"}
                          </button>
                        `:""}
                  </span>
                  <span class="version-info">
                    v${ie} •

                    <a
                      href="https://github.com/uimaxbai/apple-music-web-components"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Star me on GitHub</a
                    >
                  </span>
                </div>
              </footer>
            `}
      </div>
    `}}f.styles=fe`
    /* ==========================================================================
       YOULYPLUS-INSPIRED STYLING - Design Tokens & Variables
       ========================================================================== */
    :host {
      --lyplus-lyrics-palette: var(
        --am-lyrics-highlight-color,
        var(--highlight-color, #ffffff)
      );
      --lyplus-text-primary: var(--lyplus-lyrics-palette);
      /* Use color-mix with the text color rather than just opacity so it adapts */
      --lyplus-text-secondary: color-mix(
        in srgb,
        var(--lyplus-lyrics-palette),
        transparent 45%
      );

      --lyplus-padding-base: 1em;
      --lyplus-padding-line: 10px;
      --lyplus-padding-gap: 0.3em;
      --lyplus-border-radius-base: 0.6em;
      --lyplus-gap-dot-size: 0.4em;
      --lyplus-gap-dot-margin: 0.08em;

      --lyplus-font-size-base: 32px;
      --lyplus-font-size-base-grow: 24.5;
      --lyplus-font-size-subtext: 0.6em;

      --lyplus-blur-amount: 0.07em;
      --lyplus-blur-amount-near: 0.035em;
      --lyplus-fade-gap-timing-function: ease-out;

      --lyrics-scroll-padding-top: 25%;

      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
        Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: transparent;
      height: 100%;
      overflow: hidden;
      font-weight: bold;
      color: var(--lyplus-text-primary);
    }

    /* ==========================================================================
       CONTAINER & SCROLL BEHAVIOR
       ========================================================================== */
    .lyrics-container {
      padding: 20px;
      padding-top: 80px;
      border-radius: 8px;
      background-color: transparent;
      width: 100%;
      height: 100%;
      max-height: 100vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
      scrollbar-width: none;
      transform: translateZ(0);
    }

    .lyrics-container::-webkit-scrollbar {
      display: none;
    }

    /* Disable transitions during touch-scrolling for 1:1 feedback */
    .lyrics-container.touch-scrolling .lyrics-line,
    .lyrics-container.touch-scrolling .lyrics-plus-metadata {
      transition: none !important;
    }

    /* Apply smooth gliding transition for mouse-wheel scrolling */
    .lyrics-container.wheel-scrolling .lyrics-line {
      transition: transform 0.3s ease-out !important;
    }

    .lyrics-line.scroll-animate {
      transition: none !important; /* Prevent conflict with scroll animation */
      animation-name: lyrics-scroll;
      animation-duration: 400ms;
      animation-timing-function: cubic-bezier(0.41, 0, 0.12, 0.99);
      animation-fill-mode: both;
      animation-delay: var(--lyrics-line-delay, 0ms);
    }

    .lyrics-container.user-scrolling .lyrics-line {
      --lyrics-line-delay: 0ms !important;
      transition-delay: 0ms !important;
    }

    /* ==========================================================================
       LYRICS LINE BASE STYLES
       ========================================================================== */
    .lyrics-line {
      padding: var(--lyplus-padding-line);
      opacity: 0.8;
      color: var(--lyplus-text-secondary);
      font-size: var(--lyplus-font-size-base);
      cursor: pointer;
      transform-origin: left;
      transform: translateZ(1px);
      transition:
        opacity 0.3s ease,
        transform 0.4s cubic-bezier(0.41, 0, 0.12, 0.99)
          var(--lyrics-line-delay, 0ms),
        filter 0.3s ease;
      will-change: transform, filter, opacity;
      content-visibility: auto;
      text-rendering: optimizeLegibility;
      overflow-wrap: break-word;
      mix-blend-mode: lighten;
      border-radius: var(--lyplus-border-radius-base);
    }

    .lyrics-line:not(.scroll-animate) {
      animation: none;
    }

    /* --- Line Container & Vocal Containers --- */
    .lyrics-line-container {
      overflow-wrap: break-word;
      transform-origin: left;
      transform: scale3d(0.93, 0.93, 0.95);
      transition:
        transform 0.7s ease,
        background-color 0.7s,
        color 0.7s;
    }

    .lyrics-line.active .lyrics-line-container,
    .lyrics-line.pre-active .lyrics-line-container {
      transform: scale3d(1.001, 1.001, 1);
      will-change: transform;
      transition:
        transform 0.5s ease,
        background-color 0.18s,
        color 0.18s;
    }

    .main-vocal-container {
      transform-origin: 5% 50%;
      margin: 0;
    }

    .background-vocal-container {
      max-height: 0;
      padding-top: 0.2em;
      overflow: visible;
      opacity: 0;
      font-size: var(--lyplus-font-size-subtext);
      transition:
        max-height 0.3s,
        opacity 0.6s,
        padding 0.6s;
      margin: 0;
    }

    .lyrics-line.active .background-vocal-container {
      max-height: 4em;
      opacity: 1;
      transition:
        max-height 0.6s,
        opacity 0.6s,
        padding 0.6s;
      will-change: max-height, opacity, padding;
    }

    /* --- Line States & Modifiers --- */
    .lyrics-line.active {
      opacity: 1;
      color: var(--lyplus-text-primary);
      will-change: transform, opacity;
    }

    .lyrics-line.singer-right {
      text-align: end;
    }

    .lyrics-line.singer-right .lyrics-line-container,
    .lyrics-line.singer-right .main-vocal-container {
      transform-origin: right;
    }

    .lyrics-line.rtl-text {
      direction: rtl;
    }

    /* --- Unsynced (Plain Text) Lyrics Overrides --- */
    .lyrics-container.is-unsynced .lyrics-line {
      opacity: 1 !important;
      color: var(--lyplus-text-primary) !important;
      filter: none !important;
      transform: none !important;
      cursor: default;
    }

    .lyrics-container.is-unsynced .lyrics-line-container {
      transform: none !important;
      background-color: transparent !important;
    }

    .lyrics-container.is-unsynced .lyrics-syllable {
      color: var(--lyplus-text-primary) !important;
      background-color: transparent !important;
      -webkit-background-clip: unset !important;
      background-clip: unset !important;
      -webkit-text-fill-color: unset !important;
      text-fill-color: unset !important;
      text-shadow: none !important;
      filter: none !important;
      opacity: 1 !important;
      transform: none !important;
    }

    @media (hover: hover) and (pointer: fine) {
      .lyrics-line:hover {
        background: var(--hover-background-color, rgba(255, 255, 255, 0.13));
      }
      .lyrics-container.is-unsynced .lyrics-line:hover {
        background: transparent !important;
      }
    }

    /* --- Blur Effect for Inactive Lines --- */
    .lyrics-container.blur-inactive-enabled:not(.not-focused)
      .lyrics-line:not(.active):not(.pre-active):not(.lyrics-gap) {
      filter: blur(var(--lyplus-blur-amount));
    }

    .lyrics-container.blur-inactive-enabled:not(.not-focused)
      .lyrics-line.post-active-line:not(.lyrics-gap):not(.active):not(
        .pre-active
      ),
    .lyrics-container.blur-inactive-enabled:not(.not-focused)
      .lyrics-line.next-active-line:not(.lyrics-gap):not(.active):not(
        .pre-active
      ),
    .lyrics-container.blur-inactive-enabled:not(.not-focused)
      .lyrics-line.lyrics-activest:not(.active):not(.lyrics-gap):not(
        .pre-active
      ) {
      filter: blur(var(--lyplus-blur-amount-near));
    }

    /* Unblur all lines when user is scrolling */
    .lyrics-container.user-scrolling .lyrics-line {
      filter: none !important;
      opacity: 0.8 !important;
    }

    /* Unblur early for pre-active lines */
    .lyrics-container.blur-inactive-enabled .lyrics-line.pre-active {
      filter: blur(0px) !important;
      opacity: var(--lyplus-primary-opacity);
    }

    /* ==========================================================================
       WORD & SYLLABLE STYLES
       ========================================================================== */
    .lyrics-word:not(.allow-break) {
      display: inline-block;
      vertical-align: baseline;
    }

    .lyrics-word.allow-break {
      display: inline;
    }

    .lyrics-syllable-wrap {
      display: inline;
    }

    .lyrics-syllable-wrap:has(.lyrics-syllable.transliteration) {
      display: inline-flex;
      flex-direction: column;
      align-items: start;
    }

    .lyrics-syllable {
      display: inline-block;
      vertical-align: baseline;
      color: transparent;
      background-color: var(--lyplus-text-secondary);
      white-space: pre-wrap;
      font-variant-ligatures: none;
      font-feature-settings: 'liga' 0;
      background-clip: text;
      -webkit-background-clip: text;
      transition:
        color 0.7s,
        background-color 0.7s,
        transform 0.7s ease;
    }

    /* --- Syllable States --- */
    .lyrics-syllable.finished {
      background-color: var(--lyplus-text-primary);
      transition: transform 1s ease !important;
    }

    .lyrics-syllable.finished:has(.char) {
      background-color: transparent;
    }

    .lyrics-line:not(.active) .lyrics-syllable.finished {
      transition: color 0.18s;
    }

    .lyrics-line.active:not(.lyrics-gap) .lyrics-syllable {
      transform: translateY(0.001%) translateZ(1px);
      transition:
        transform 1s ease,
        background-color 0.5s,
        color 0.5s;
      will-change: transform, background;
    }

    /* --- Wipe Highlight Effect --- */
    .lyrics-line.active:not(.lyrics-gap)
      .lyrics-syllable.highlight:not(:has(.char)),
    .lyrics-line.active:not(.lyrics-gap)
      .lyrics-syllable.pre-highlight:not(:has(.char)) {
      background-repeat: no-repeat;
      background-image:
        linear-gradient(
          90deg,
          #ffffff00 0%,
          var(--lyplus-text-primary, #fff) 50%,
          #0000 100%
        ),
        linear-gradient(
          90deg,
          var(--lyplus-text-primary, #fff) 100%,
          #0000 100%
        );
      background-size:
        0.5em 100%,
        0% 100%;
      background-position:
        -0.5em 0%,
        -0.25em 0%;
    }

    .lyrics-line.active:not(.lyrics-gap) .lyrics-syllable.highlight.rtl-text,
    .lyrics-line.active:not(.lyrics-gap)
      .lyrics-syllable.pre-highlight.rtl-text {
      direction: rtl;
      background-image:
        linear-gradient(
          -90deg,
          var(--lyplus-text-primary) 0%,
          transparent 100%
        ),
        linear-gradient(
          -90deg,
          var(--lyplus-text-primary) 100%,
          transparent 100%
        );
      background-position:
        calc(100% + 0.5em) 0%,
        right;
    }

    .lyrics-line.active:not(.lyrics-gap)
      .lyrics-word:not(.growable)
      .lyrics-syllable.highlight,
    .lyrics-word.growable .lyrics-syllable.cleanup .char {
      transform: translateY(-3.5%) translateZ(1px);
    }

    .lyrics-line.active:not(.lyrics-gap) .lyrics-syllable.highlight.finished {
      background-image: none;
    }

    .lyrics-syllable.pre-highlight {
      animation-name: pre-wipe-universal;
      animation-duration: var(--pre-wipe-duration);
      animation-delay: var(--pre-wipe-delay);
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    .lyrics-syllable.pre-highlight.rtl-text {
      animation-name: pre-wipe-universal-rtl;
    }

    .lyrics-syllable.transliteration {
      font-size: var(--lyplus-font-size-subtext);
      white-space: pre-wrap;
      pointer-events: none;
      user-select: none;
    }

    /* Syllable with chars: make syllable transparent, chars handle color */
    .lyrics-line .lyrics-syllable:has(span.char):not(.finished) {
      background-color: transparent;
      color: transparent;
    }

    .lyrics-syllable span.char {
      display: inline-block;
      background-color: var(--lyplus-text-secondary);
      white-space: break-spaces;
      font-variant-ligatures: none;
      font-feature-settings: 'liga' 0;
      background-clip: text;
      -webkit-background-clip: text;
      transition:
        color 0.7s,
        background-color 0.7s,
        transform 0.7s ease;
    }

    .lyrics-syllable.finished span.char {
      transition: color 0.18s;
      background-color: var(--lyplus-text-primary);
    }

    /* Active char spans: structural only, wipe animation sets gradient */
    .lyrics-line.active .lyrics-syllable span.char {
      background-clip: text;
      -webkit-background-clip: text;
      background-repeat: no-repeat;
      background-image:
        linear-gradient(
          90deg,
          #ffffff00 0%,
          var(--lyplus-text-primary, #fff) 50%,
          #0000 100%
        ),
        linear-gradient(
          90deg,
          var(--lyplus-text-primary, #fff) 100%,
          #0000 100%
        );
      background-size:
        0.5em 100%,
        0% 100%;
      background-position:
        -0.5em 0%,
        -0.25em 0%;
      transform-origin: 50% 80%;
      transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      transition:
        transform 0.7s ease,
        color 0.18s;
      will-change: background, transform;
    }

    .lyrics-line.active .lyrics-syllable span.char.highlight {
      background-image:
        linear-gradient(
          -90deg,
          var(--lyplus-text-primary, #fff) 0%,
          #0000 100%
        ),
        linear-gradient(
          -90deg,
          var(--lyplus-text-primary, #fff) 100%,
          #0000 100%
        );
      background-position:
        calc(100% + 0.5em) 0%,
        calc(100% + 0.25em) 0%;
    }

    .lyrics-line.active .lyrics-syllable.pre-highlight span.char {
      background-image:
        linear-gradient(
          90deg,
          #ffffff00 0%,
          var(--lyplus-text-primary, #fff) 50%,
          #0000 100%
        ),
        linear-gradient(
          90deg,
          var(--lyplus-text-primary, #fff) 100%,
          #0000 100%
        );
      background-size:
        0.75em 100%,
        0% 100%;
      background-position:
        -0.85em 0%,
        -0.25em 0%;
    }

    /* ==========================================================================
       INSTRUMENTAL GAP STYLES
       ========================================================================== */
    .lyrics-gap {
      height: 0;
      padding: 0 var(--lyplus-padding-gap);
      overflow: hidden;
      opacity: 0;
      box-sizing: content-box;
      background-clip: unset;
      transition:
        padding 0.3s 0.5s,
        height 0.3s 0.5s,
        opacity 0.2s 0.5s,
        transform 0.3s var(--lyrics-line-delay, 0ms);
    }

    .lyrics-gap.active {
      height: 1.3em;
      padding: var(--lyplus-padding-gap);
      opacity: 1;
      overflow: visible;
      transition:
        padding 0.3s,
        height 0.3s,
        opacity 0.2s 0.3s,
        transform 0.3s;
      will-change: height, opacity, padding;
    }

    /* Exiting state: keep gap visible while dots animate out */
    .lyrics-gap.gap-exiting {
      height: 1.3em;
      padding: var(--lyplus-padding-gap);
      opacity: 1;
      overflow: visible;
      transition:
        padding 0.3s 0.5s,
        height 0.3s 0.5s,
        opacity 0.2s 0.5s,
        transform 0.3s;
    }

    .lyrics-gap .main-vocal-container {
      transform: translateY(-25%) scale(1) translateZ(0);
    }

    /* Jump animation plays during exit */
    .lyrics-gap.gap-exiting .main-vocal-container {
      animation: gap-ended 0.8s ease forwards;
    }

    .lyrics-gap:not(.active):not(.gap-exiting) .main-vocal-container {
      transform: translateY(-25%) scale(0) translateZ(0);
    }

    .lyrics-gap:not(.active):not(.gap-exiting)
      .main-vocal-container
      .lyrics-word {
      animation-play-state: paused;
    }

    .lyrics-gap.active .main-vocal-container .lyrics-word {
      animation: gap-loop 4s ease infinite alternate;
      will-change: transform;
    }

    .lyrics-gap .lyrics-syllable {
      display: inline-block;
      width: var(--lyplus-gap-dot-size);
      height: var(--lyplus-gap-dot-size);
      background-color: var(--lyplus-text-primary);
      border-radius: 50%;
      margin: 0 var(--lyplus-gap-dot-margin);
    }

    /* Line-synced lyrics should fade in instantly/quickly instead of wiping */
    .lyrics-syllable.line-synced {
      background: transparent !important;
      color: var(--lyplus-text-secondary) !important;
    }

    .lyrics-line.active .lyrics-syllable.line-synced {
      animation: fade-in-line 0.2s ease-out forwards !important;
      color: var(--lyplus-text-primary) !important;
    }

    @keyframes fade-in-line {
      from {
        opacity: 0.5;
        color: var(--lyplus-text-secondary);
      }
      to {
        opacity: 1;
        color: var(--lyplus-lyrics-palette);
      }
    }

    .lyrics-gap .lyrics-syllable {
      background-color: var(--lyplus-text-secondary);
      background-clip: unset;
    }

    .lyrics-gap.active .lyrics-syllable.highlight,
    .lyrics-gap.active .lyrics-syllable.finished,
    .lyrics-gap.gap-exiting .lyrics-syllable,
    .lyrics-gap:not(.active).post-active-line .lyrics-syllable,
    .lyrics-gap:not(.active).lyrics-activest .lyrics-syllable {
      background-color: var(--lyplus-text-primary);
      animation: none !important;
      opacity: 1;
    }

    .lyrics-gap.active .lyrics-syllable.finished {
      animation: none !important;
    }

    /* ==========================================================================
       METADATA & FOOTER STYLES
       ========================================================================== */
    .lyrics-plus-metadata {
      display: block;
      position: relative;
      box-sizing: border-box;
      font-weight: normal;
      transform: translateY(var(--lyrics-scroll-offset, 0px)) translateZ(1px);
      transition:
        opacity 0.3s ease,
        transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)
          var(--lyrics-line-delay, 0ms),
        filter 0.3s ease;
    }

    .lyrics-plus-empty {
      display: block;
      height: 100vh;
      transform: translateY(var(--lyrics-scroll-offset, 0px)) translateZ(1px);
    }

    .lyrics-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      text-align: left;
      font-size: 0.8em;
      color: rgba(255, 255, 255, 0.5);
      padding: 10px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: 10px;
      font-weight: normal;
    }

    .lyrics-footer p {
      margin: 5px 0;
    }

    .lyrics-footer a {
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
    }

    .lyrics-footer a:hover {
      text-decoration: underline;
    }

    .footer-content {
      display: flex;
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .footer-controls {
      display: flex;
      align-items: center;
    }

    /* ==========================================================================
       HEADER & CONTROLS
       ========================================================================== */
    .lyrics-header {
      display: flex;
      padding: 10px 0;
      margin-bottom: 10px;
      gap: 10px;
      justify-content: space-between;
      align-items: center;
    }

    .lyrics-header .download-button {
      background: none;
      border: none;
      cursor: pointer;
      color: #aaa;
      padding: 0;
      margin-left: 10px;
      vertical-align: middle;
      display: inline-flex;
      align-items: center;
      font-family: inherit;
    }

    .lyrics-header .download-button:hover {
      color: rgba(255, 255, 255, 0.9);
    }

    .header-controls {
      display: flex;
      gap: 8px;
    }

    .download-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .control-button {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 0.8em;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      transition: all 0.2s;
      font-weight: normal;
    }

    .control-button:hover {
      color: rgba(255, 255, 255, 0.9);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .control-button.active {
      background-color: var(--lyplus-text-primary);
      border-color: var(--lyplus-text-primary);
      color: #000;
    }

    .format-select {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.8em;
      margin-left: 10px;
      padding: 2px 5px;
      cursor: pointer;
      font-weight: normal;
      font-family: inherit;
    }

    .format-select:hover {
      color: rgba(255, 255, 255, 0.9);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .format-select option {
      background: #1a1a1a;
      color: #fff;
    }

    /* ==========================================================================
       TRANSLATION & ROMANIZATION
       ========================================================================== */
    .lyrics-translation-container,
    .lyrics-romanization-container {
      padding-top: 0.2em;
      opacity: 0.8;
      font-size: var(--lyplus-font-size-subtext);
      overflow-wrap: break-word;
      pointer-events: none;
      user-select: none;
      transition:
        opacity 0.3s ease,
        color 0.3s;
      font-weight: normal;
    }

    .lyrics-romanization-container {
      direction: ltr !important;
    }

    .lyrics-romanization-container.rtl-text {
      direction: rtl !important;
    }

    .lyrics-romanization-container .lyrics-syllable {
      white-space: pre-wrap;
    }

    .lyrics-translation-container {
      opacity: 0.5;
    }

    .main-line-wrapper.small {
      font-size: 0.5em;
      opacity: 0.8;
      display: block;
      margin-bottom: 0px;
    }

    .translation-line {
      font-size: 1em;
      font-weight: bold;
      display: block;
      margin-top: 0px;
      line-height: 1.1;
    }

    .romanized-line {
      font-size: 0.5em;
      color: rgba(255, 255, 255, 0.5);
      display: block;
      margin-top: 2px;
      font-weight: normal;
    }

    /* ==========================================================================
       SKELETON LOADING
       ========================================================================== */
    @keyframes skeleton-loading {
      0% {
        background-color: rgba(255, 255, 255, 0.1);
      }
      100% {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }

    .skeleton-line {
      height: 2.5em;
      margin: 20px 0;
      border-radius: 8px;
      animation: skeleton-loading 1s linear infinite alternate;
      opacity: 0.7;
      width: 60%;
    }

    .skeleton-line:nth-child(even) {
      width: 80%;
    }
    .skeleton-line:nth-child(3n) {
      width: 50%;
    }
    .skeleton-line:nth-child(5n) {
      width: 70%;
    }

    .no-lyrics {
      color: rgba(255, 255, 255, 0.5);
      font-size: 1.2em;
      text-align: center;
      padding: 2em;
      font-weight: normal;
    }

    /* ==========================================================================
       KEYFRAME ANIMATIONS
       ========================================================================== */

    /* Wipe animation for syllables */
    @keyframes wipe {
      from {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          -0.375em 0%,
          left;
      }
      to {
        background-size:
          0.75em 100%,
          100% 100%;
        background-position:
          calc(100% + 0.375em) 0%,
          left;
      }
    }

    @keyframes start-wipe {
      0% {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          -0.375em 0%,
          left;
      }
      100% {
        background-size:
          0.75em 100%,
          100% 100%;
        background-position:
          calc(100% + 0.375em) 0%,
          left;
      }
    }

    @keyframes wipe-rtl {
      from {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          calc(100% + 0.375em) 0%,
          calc(100% + 0.36em);
      }
      to {
        background-size:
          0.75em 100%,
          100% 100%;
        background-position:
          -0.75em 0%,
          right;
      }
    }

    @keyframes start-wipe-rtl {
      0% {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          calc(100% + 0.75em) 0%,
          calc(100% + 0.5em);
      }
      100% {
        background-size:
          0.75em 100%,
          100% 100%;
        background-position:
          -0.75em 0%,
          right;
      }
    }

    @keyframes pre-wipe-universal {
      from {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          -0.75em 0%,
          left;
      }
      to {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          -0.375em 0%,
          left;
      }
    }

    @keyframes pre-wipe-universal-rtl {
      from {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          calc(100% + 0.75em) 0%,
          right;
      }
      to {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          calc(100% + 0.375em) 0%,
          right;
      }
    }

    @keyframes pre-wipe-char {
      from {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          -0.85em 0%,
          left;
      }
      to {
        background-size:
          0.75em 100%,
          0% 100%;
        background-position:
          -0.85em 0%,
          left;
      }
    }

    /* Gap dot animations */
    @keyframes gap-loop {
      from {
        transform: scale(1.15);
      }
      to {
        transform: scale(0.85);
      }
    }

    @keyframes gap-ended {
      0% {
        transform: translateY(-25%) scale(1) translateZ(0);
      }
      35% {
        transform: translateY(-25%) scale(1.2) translateZ(0);
      }
      100% {
        transform: translateY(-25%) scale(0) translateZ(0);
      }
    }

    @keyframes fade-gap {
      from {
        background-color: var(--lyplus-text-secondary);
      }
      to {
        background-color: var(--lyplus-text-primary);
      }
    }

    /* Scroll animation — class is removed and re-added (with a forced
       reflow in between) to reliably restart the animation each time */
    @keyframes lyrics-scroll {
      from {
        transform: translateY(var(--scroll-delta)) translateZ(1px);
      }
      to {
        transform: translateY(0) translateZ(1px);
      }
    }

    /* Character grow animation - exact copy from YouLyPlus */
    @keyframes grow-dynamic {
      0% {
        transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        filter: drop-shadow(
          0 0 0
            color-mix(in srgb, var(--lyplus-lyrics-palette), transparent 100%)
        );
      }
      25%,
      30% {
        transform: matrix3d(
          calc(var(--max-scale) * calc(var(--lyplus-font-size-base-grow) / 25)),
          0,
          0,
          0,
          0,
          calc(var(--max-scale) * calc(var(--lyplus-font-size-base-grow) / 25)),
          0,
          0,
          0,
          0,
          1,
          0,
          calc(
            var(--char-offset-x, 0) *
              calc(var(--lyplus-font-size-base-grow) / 25)
          ),
          var(--translate-y-peak, -2),
          0,
          1
        );
        filter: drop-shadow(
          0 0 0.1em
            color-mix(
              in srgb,
              var(--lyplus-lyrics-palette),
              transparent calc((1 - var(--shadow-intensity, 1)) * 100%)
            )
        );
      }
      100% {
        transform: translateY(-3.5%) translateZ(1px);
        filter: drop-shadow(
          0 0 0
            color-mix(in srgb, var(--lyplus-lyrics-palette), transparent 100%)
        );
      }
    }

    @keyframes grow-static {
      0%,
      100% {
        transform: scale3d(1.01, 1.01, 1.1) translateY(-0.05%);
        text-shadow: 0 0 0
          color-mix(in srgb, var(--lyplus-lyrics-palette), transparent 100%);
      }
      30%,
      40% {
        transform: scale3d(1.1, 1.1, 1.1) translateY(-0.05%);
        text-shadow: 0 0 0.3em
          color-mix(in srgb, var(--lyplus-lyrics-palette), transparent 50%);
      }
    }

    /* Fade in animation */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 0.7;
        transform: translateY(0);
      }
    }

    /* Legacy support */
    .opposite-turn {
      text-align: right;
    }

    .singer-right {
      text-align: right;
      justify-content: flex-end;
    }

    .singer-left {
      text-align: left;
      justify-content: flex-start;
    }

    /* Legacy progress-text for backward compatibility */
    .progress-text {
      position: relative;
      display: inline-block;
      background: linear-gradient(
        to right,
        var(--lyplus-text-primary) 0%,
        var(--lyplus-text-primary) var(--line-progress, 0%),
        var(--lyplus-text-secondary) var(--line-progress, 0%),
        var(--lyplus-text-secondary) 100%
      );
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      color: var(--lyplus-text-secondary);
      transform: translate3d(0, 0, 0);
      will-change: background-size;
    }

    .progress-text::before {
      display: none;
    }

    .active-line {
      font-weight: bold;
    }

    .background-text {
      display: block;
      color: var(--lyplus-text-secondary);
      font-size: 0.8em;
      font-style: normal;
      margin: 0;
      flex-shrink: 0;
      line-height: 1.1;
    }

    .background-text.before {
      order: -1;
    }

    .background-text.after {
      order: 1;
    }

    .instrumental-line {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
      color: var(--lyplus-text-secondary);
      font-size: 0.9em;
      padding: 4px 10px;
      animation: fadeInUp 220ms ease;
      font-weight: normal;
    }

    .instrumental-duration {
      color: var(--lyplus-text-secondary);
      font-size: 0.8em;
    }
  `;E([U({type:String})],f.prototype,"query",void 0);E([U({type:String})],f.prototype,"musicId",void 0);E([U({type:String})],f.prototype,"isrc",void 0);E([U({type:String,attribute:"song-title"})],f.prototype,"songTitle",void 0);E([j()],f.prototype,"downloadFormat",void 0);E([U({type:String,attribute:"song-artist"})],f.prototype,"songArtist",void 0);E([U({type:String,attribute:"song-album"})],f.prototype,"songAlbum",void 0);E([U({type:Number,attribute:"song-duration"})],f.prototype,"songDurationMs",void 0);E([U({type:String,attribute:"highlight-color"})],f.prototype,"highlightColor",void 0);E([U({type:String,attribute:"hover-background-color"})],f.prototype,"hoverBackgroundColor",void 0);E([U({type:String,attribute:"font-family"})],f.prototype,"fontFamily",void 0);E([U({type:Boolean})],f.prototype,"autoScroll",void 0);E([U({type:Boolean})],f.prototype,"interpolate",void 0);E([j()],f.prototype,"showRomanization",void 0);E([j()],f.prototype,"showTranslation",void 0);E([U({type:Number})],f.prototype,"duration",void 0);E([U({type:Number,attribute:"currenttime",hasChanged:()=>!1})],f.prototype,"currentTime",null);E([j()],f.prototype,"isLoading",void 0);E([j()],f.prototype,"lyrics",void 0);E([j()],f.prototype,"lyricsSource",void 0);E([j()],f.prototype,"availableSources",void 0);E([j()],f.prototype,"currentSourceIndex",void 0);E([j()],f.prototype,"isFetchingAlternatives",void 0);E([j()],f.prototype,"hasFetchedAllProviders",void 0);E([Fe(".lyrics-container")],f.prototype,"lyricsContainer",void 0);E([j()],f.prototype,"isUserScrolling",void 0);window.customElements.define("am-lyrics",f);
