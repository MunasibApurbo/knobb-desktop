import{c as p}from"./index-VG63Lefu.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=p("ChartColumn",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=p("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]),M=new Set(["complete","repeat"]),k=(e=50)=>Math.min(95,Math.max(5,Math.round(e))),S=(e,s)=>!Number.isFinite(e)||e<=0?30:Math.min(Math.round(e),Math.max(30,Math.ceil(e*(k(s)/100)))),w=(e,s=50)=>{if(M.has(e.eventType))return!0;const o=S(e.durationSeconds||e.duration||0,s);return e.listenedSeconds>=o},D=(e,s)=>{if(s==="all")return e;const o=s==="7d"?7:30,a=new Date;return a.setDate(a.getDate()-o),e.filter(c=>new Date(c.playedAt)>=a)},v=(e,s=50)=>{var u;const o=e.reduce((t,n)=>t+Math.max(0,n.listenedSeconds||0),0),a=e.filter(t=>w(t,s)),c={},r={},i=new Array(24).fill(0);for(const t of e){const n=Math.max(0,t.listenedSeconds||0);if(n<=0)continue;const y=(((u=t.artist)==null?void 0:u.trim())||"Unknown Artist").split(/[,&]+/).map(d=>d.trim()).filter(Boolean);for(const d of y)c[d]=(c[d]||0)+n;const l=t.trackKey||t.id||`${t.title}::${t.artist}`;r[l]||(r[l]={track:t,listenedSeconds:0,playCount:0}),r[l].listenedSeconds+=n,r[l].playCount+=1;const C=new Date(t.playedAt).getHours();i[C]+=n}const h=Object.entries(c).map(([t,n])=>({artist:t,listenedSeconds:n})).sort((t,n)=>n.listenedSeconds-t.listenedSeconds).slice(0,5),f=Object.values(r).sort((t,n)=>n.listenedSeconds-t.listenedSeconds||n.playCount-t.playCount).slice(0,5),m=i.indexOf(Math.max(...i));return{totalMinutes:Math.round(o/60),totalCountedPlays:a.length,topArtists:h,topTracks:f,peakHour:m,hourCounts:i}};export{g as C,x as T,v as c,D as f};
