import{r as u,j as p}from"./index-DKK_mt8D.js";import{loadAmLyricsComponent as C,resolveLyricsArtistLabel as T,loadLyricsForTrack as A}from"./lyricsPanelData-DOz4h-xN.js";import"./musicApi-xI5-vHu-.js";import"./SettingsContext-DF3O_Vs0.js";import"./safeStorage-Wuo35zL5.js";import"./youtubeMusicApi-B6wRBwVg.js";const z=u.lazy(C),S="var(--font-sans, 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",R="knobb-am-lyrics-overrides";function B(r){return r.id}function E(r){return r!=null&&r.lines.length?r.lines.map((o,c)=>{const m=c<r.lines.length-1?r.lines[c+1].timeMs:o.timeMs+(r.isSynced?5e3:4e3);return{text:[{text:o.text,part:!1,timestamp:o.timeMs,endtime:m,lineSynced:r.isSynced}],background:!1,backgroundText:[],oppositeTurn:!1,timestamp:o.timeMs,endtime:m,isWordSynced:!1}}):[]}function P(r,o){return o==="video-panel"?"h-full overflow-y-auto px-2 pb-24 pt-[28%]":r==="compact"?"h-full overflow-y-auto px-3 pb-14 pt-[12%]":r==="immersive"?"h-full overflow-y-auto px-3 pb-16 pt-[18%]":"h-full overflow-y-auto px-10 pb-24 pt-[25%]"}function q(r,o){return o==="video-panel"?"mb-4 text-[clamp(2.15rem,1.05vw+1.45rem,3.15rem)] font-semibold leading-[1.04] tracking-[-0.05em] text-white/92":r==="compact"?"mb-2 text-2xl font-semibold leading-[1.12] tracking-[-0.04em] text-white/88":r==="immersive"?"mb-3 text-[clamp(3.1rem,2.6vw+1.8rem,4.85rem)] font-semibold leading-[1.08] tracking-[-0.05em] text-white/92":"mb-5 text-4xl font-semibold leading-[1.3] tracking-[-0.04em] text-white/88"}function _(r,o,c,m){const y=r.shadowRoot;if(!y)return;const s=o==="compact",a=o==="immersive",t=m==="video-panel";let l=y.getElementById(R);if(l)if(l.dataset.density!==o||l.dataset.variant!==m)l.remove();else return;l=document.createElement("style"),l.id=R,l.dataset.density=o,l.dataset.variant=m,l.textContent=`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      color-scheme: dark;
      font-family: ${S};
      font-weight: 600;
      --am-lyrics-highlight-color: rgba(255, 255, 255, 0.98);
      --hover-background-color: ${t?"transparent":"hsl(var(--player-waveform) / 0.18)"};
      --lyplus-text-primary: rgba(255, 255, 255, 0.98);
      --lyplus-text-secondary: ${t?"rgba(255, 255, 255, 0.18)":"rgba(255, 255, 255, 0.72)"};
      --lyplus-blur-amount: ${t?"8px":"7px"};
      --lyplus-blur-amount-near: ${t?"3px":"4px"};
      --lyplus-primary-opacity: 1;
      --lyplus-font-size-base: ${t?"clamp(2.15rem, 1.05vw + 1.45rem, 3.15rem)":s?"24px":a?"clamp(3.1rem, 2.6vw + 1.8rem, 4.85rem)":"36px"};
      --lyplus-font-size-base-grow: ${t?"8px":s?"3px":a?"14px":"10px"};
      --lyrics-scroll-padding-top: ${t?"28%":s?"12%":a?"18%":"25%"};
    }

    .lyrics-container {
      background: transparent !important;
      padding: ${t?"18px 8px 140px":s?"0 12px 56px":a?"0 10px 72px":"0 40px 100px"} !important;
    }

    .lyrics-container:has(.no-lyrics) {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
    }

    .lyrics-header {
      display: none !important;
    }

    .header-controls,
    .download-controls,
    .footer-content,
    .source-info,
    .version-info {
      display: none !important;
    }

    .lyrics-line,
    .lyrics-syllable,
    .background-text,
    .lyrics-translation-container,
    .lyrics-romanization-container {
      letter-spacing: ${t||a?"-0.05em":"-0.04em"};
      line-height: ${t?"1.04":s?"1.12":a?"1.08":"1.3"} !important;
      margin-bottom: ${t?"16px":s?"8px":a?"10px":"20px"} !important;
      transition: background-color 200ms ease, color 200ms ease, opacity 200ms ease, transform 200ms ease;
    }

    .lyrics-line {
      opacity: ${t?"0.26":"0.8"} !important;
      color: ${t?"rgba(255, 255, 255, 0.24)":"rgba(255, 255, 255, 0.72)"} !important;
      mix-blend-mode: ${t?"normal":"lighten"};
      padding: ${t?"0.05em 0":"inherit"};
      border-radius: ${t?"0":"inherit"};
    }

    .lyrics-line.active,
    .lyrics-line.pre-active {
      opacity: 1 !important;
      color: rgba(255, 255, 255, 0.98) !important;
      filter: none !important;
    }

    .lyrics-line.post-active-line,
    .lyrics-line.next-active-line,
    .lyrics-line.lyrics-activest {
      opacity: ${t?"0.46":"0.8"} !important;
    }
    ${t?`
    .lyrics-line .lyrics-line-container {
      transform: scale3d(0.96, 0.96, 1);
      transform-origin: left center;
    }

    .lyrics-line .main-vocal-container {
      text-shadow: 0 10px 24px rgba(0, 0, 0, 0.34);
    }

    .lyrics-line.active .lyrics-line-container,
    .lyrics-line.pre-active .lyrics-line-container {
      transform: scale3d(1, 1, 1);
    }

    .lyrics-line.active .main-vocal-container,
    .lyrics-line.pre-active .main-vocal-container {
      text-shadow: 0 14px 32px rgba(0, 0, 0, 0.45);
    }
    `:""}

    .lyrics-footer,
    .version-info {
      display: none !important;
    }

    .no-lyrics {
      display: ${c?"none":"block"} !important;
      width: min(100%, 12ch) !important;
      margin: 0 auto !important;
      font-family: ${S} !important;
      font-size: ${s?"1.5rem":a?"clamp(2.75rem, 2.4vw + 1.85rem, 4.4rem)":"clamp(2rem, 3.5vw, 3.5rem)"} !important;
      letter-spacing: -0.03em !important;
      text-align: center !important;
      color: rgba(255, 255, 255, 0.46) !important;
    }
  `,y.appendChild(l)}function L(r,o,c,m){_(r,o,c,m)}function G({currentTime:r,onSeek:o,track:c,compact:m=!1,density:y,variant:s="default",hideEmptyState:a=!1,onAvailabilityChange:t}){const l=u.useRef(null),$=B(c),[n,b]=u.useState(null),[x,k]=u.useState(!0),f=y??(m?"compact":"default"),j=T(c),M=c.album,F=Math.max(0,Math.round(r*1e3)),v=!!(n!=null&&n.lines.length&&!n.isSynced);u.useEffect(()=>{let e=!1;return k(!0),b(null),A(c,j,M).then(i=>{e||b(i)}).catch(()=>{e||b(null)}).finally(()=>{e||k(!1)}),()=>{e=!0}},[M,j,c]),u.useEffect(()=>{let e=0,i=0,d=null;const h=60,w=()=>{const g=l.current;if(!g){i<h&&(i+=1,e=window.requestAnimationFrame(w));return}if(g.shadowRoot){L(g,f,a,s),d=new MutationObserver(()=>{const N=l.current;N&&L(N,f,a,s)}),d.observe(g.shadowRoot,{childList:!0,subtree:!0});return}i<h&&(i+=1,e=window.requestAnimationFrame(w))};return e=window.requestAnimationFrame(w),()=>{window.cancelAnimationFrame(e),d==null||d.disconnect()}},[a,$,f,s]),u.useEffect(()=>{var d,h;if(v)return;const e=l.current;if(!e)return;const i=E(n);e.isLoading=x,e.currentSourceIndex=0,e.hasFetchedAllProviders=!0,i.length>0?(e.lyrics=i,e.lyricsSource=(n==null?void 0:n.lyricsProvider)||"LRCLIB",e.availableSources=[{lines:i,source:(n==null?void 0:n.lyricsProvider)||"LRCLIB"}]):(e.lyrics=[],e.lyricsSource=null,e.availableSources=[]),(d=e.requestUpdate)==null||d.call(e),L(e,f,a,s),!x&&i.length>0&&((h=e.onLyricsLoaded)==null||h.call(e))},[a,x,n,f,v,s]),u.useEffect(()=>{if(t){if(x){t("loading");return}t(n!=null&&n.lines.length?"available":"empty")}},[x,n,t]);const I=e=>{const{detail:i}=e;(i==null?void 0:i.timestamp)!==void 0&&o(Math.max(0,i.timestamp/1e3))};return p.jsx("div",{className:"flex h-full min-h-0 flex-col",children:p.jsx("div",{className:"min-h-0 flex-1 overflow-hidden",children:v?p.jsx("div",{className:P(f,s),"data-testid":"static-lyrics-panel",children:p.jsxs("div",{className:"mx-auto max-w-[36rem]",children:[p.jsx("div",{className:"mb-6 text-xs font-medium uppercase tracking-[0.28em] text-white/45",children:"Unsynced lyrics"}),n==null?void 0:n.lines.map((e,i)=>p.jsx("p",{className:q(f,s),children:e.text},`${e.timeMs}:${e.text}:${i}`))]})}):p.jsx(u.Suspense,{fallback:p.jsx("div",{className:"flex h-full items-center justify-center text-sm text-muted-foreground",children:"Loading lyrics..."}),children:p.jsx(z,{ref:e=>{l.current=e},className:"knobb-am-lyrics block h-full w-full",autoScroll:!0,currentTime:F,duration:Math.round(c.duration*1e3),fontFamily:S,highlightColor:"#f6f6f6",hoverBackgroundColor:"hsl(var(--player-waveform) / 0.18)",interpolate:!1,onLineClick:I},$)})})})}export{G as LyricsPanel};
