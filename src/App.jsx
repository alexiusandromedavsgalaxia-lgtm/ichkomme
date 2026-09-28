import React, {useEffect, useMemo, useState} from "react";

const artists = [
 {id:"erika", name:"Erika Vikman", country:"Finland", flag:"🇫🇮", eurovision:"2025", color:"pink", songs:["ICH KOMME","Cicciolina","Syntisten pöytä","Ruoska"], tags:["Eurovision","Finland","Pop"]},
 {id:"indila", name:"Indila", country:"France", flag:"🇫🇷", eurovision:"—", color:"violet", songs:"Dernière danse;Tourner dans le vide;Love Story;Ainsi bas la vida".split(";"), tags:["France","Pop","Francophone"]},
 {id:"antigoni", name:"Antigoni", country:"Cyprus", flag:"🇨🇾", eurovision:"2026", color:"gold", songs:["JALLA","Yala","Dímelo","Stuck"], tags:["Eurovision","Cyprus","Pop"]},
 {id:"marina", name:"Marina Satti", country:"Greece", flag:"🇬🇷", eurovision:"2024", color:"green", songs:["ZARI","MANTISSA","TUCUTUM","LALALALA"], tags:["Eurovision","Greece","Greek pop"]},
 {id:"kaj", name:"KAJ", country:"Finland / Sweden", flag:"🇸🇪", eurovision:"2025", color:"blue", songs:["Bara bada bastu","Freestyler","Bonfire"], tags:["Eurovision","Sweden","Finland","Humor"]},
];

const events = [
 {year:2020,type:"release",artist:"Erika Vikman",title:"Cicciolina",country:"🇫🇮 Finland"},
 {year:2021,type:"album",artist:"Erika Vikman",title:"Erika Vikman",country:"🇫🇮 Finland"},
 {year:2024,type:"eurovision",artist:"Marina Satti",title:"ZARI",country:"🇬🇷 Greece"},
 {year:2025,type:"eurovision",artist:"Erika Vikman",title:"ICH KOMME",country:"🇫🇮 Finland"},
 {year:2025,type:"eurovision",artist:"KAJ",title:"Bara Bada Bastu",country:"🇸🇪 Sweden"},
 {year:2026,type:"eurovision",artist:"Antigoni",title:"JALLA",country:"🇨🇾 Cyprus"}
];

function App(){
 const [artist,setArtist]=useState("all"),[year,setYear]=useState("all"),[query,setQuery]=useState(""),[view,setView]=useState("overview");\n const [remoteArtists,setRemoteArtists]=useState([]),[remoteEvents,setRemoteEvents]=useState([]),[dbError,setDbError]=useState(""),[dbReady,setDbReady]=useState(false);\n useEffect(()=>{fetch("/api/artists").then(r=>r.ok?r.json():r.json().then(x=>Promise.reject(new Error(x.error||"API error")))).then(data=>{setRemoteArtists(data.artists||[]);setRemoteEvents(data.events||[]);setDbReady(true);}).catch(e=>setDbError(e.message));},[]);
 const selected=artists.find(a=>a.id===artist);
 const filtered=useMemo(()=>events.filter(e=>(artist==="all"||e.artist===selected?.name)&&(year==="all"||String(e.year)===year)&&(e.title+" "+e.artist+" "+e.country).toLowerCase().includes(query.toLowerCase())),[artist,year,query,selected]);
 return <div className="shell">
  <header><div className="brand"><span>ICHKOMME</span><small>ARTIST TRACKER</small></div><nav>{["overview","artists","timeline","countries"].map(x=><button className={view===x?"active":""} onClick={()=>setView(x)}>{x==="overview"?"OVERVIEW":x==="artists"?"ARTISTS":x==="timeline"?"TIMELINE":"COUNTRIES"}</button>)}</nav><div className="status"><i/> LIVE ARCHIVE</div></header>
  <main>{dbError&&<div className="db-error">CLOUDflare D1 OFFLINE · artist / artist-data: {dbError}</div>} {!dbReady&&!dbError&&<div className="db-error">CONECTANDO A CLOUDFLARE D1…</div>}
   <section className="hero"><div><p className="eyebrow">MUSIC · EUROVISION · LIVE HISTORY</p><h1>todo lo que<br/><em>has visto.</em></h1><p className="lead">Un tracker central para seguir artistas, canciones, conciertos, apariciones y países durante toda la década de 2020.</p></div><div className="orbit"><span>2020</span><b>2024</b><span>2025</span><strong>2026</strong></div></section>
   <section className="controls"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar artista, canción, país..." /><select value={artist} onChange={e=>setArtist(e.target.value)}><option value="all">Todos los artistas</option>{catalog.map(a=><option value={a.id}>{a.name}</option>)}</select><select value={year} onChange={e=>setYear(e.target.value)}><option value="all">2020–2029</option>{[2020,2021,2022,2023,2024,2025,2026,2027,2028,2029].map(y=><option>{y}</option>)}</select></section>
   {view==="overview"&&<><section className="artist-grid">{catalog.map(a=><article className={"artist "+a.color} onClick={()=>{setArtist(a.id);setView("artists")}}><div className="artist-top"><span>{a.flag} {a.country}</span><span>{a.eurovision!=="—"?"ESC "+a.eurovision:"MUSIC"}</span></div><div className="portrait">{a.name.split(" ").map(x=>x[0]).join("")}</div><h2>{a.name}</h2><div className="chips">{a.tags.map(t=><span>{t}</span>)}</div><p>{a.songs.slice(0,3).join(" · ")}</p></article>)}</section><section className="section-head"><div><p className="eyebrow">DECADE LOG</p><h2>Actividad registrada</h2></div><span>{filtered.length} eventos</span></section><EventList events={filtered}/></>}
   {view==="artists"&&<><section className="detail">{selected?<><div className={"detail-mark "+selected.color}>{selected.name.split(" ").map(x=>x[0]).join("")}</div><div><p className="eyebrow">{selected.flag} {selected.country} · EUROVISION {selected.eurovision}</p><h2>{selected.name}</h2><p className="lead">Seguimiento de canciones, apariciones, conciertos y lugares asociados a esta artista.</p></div></>:<div><p className="eyebrow">FIVE ACTS</p><h2>Artistas</h2></div>}</section><section className="song-grid">{(selected?[selected]:catalog).flatMap(a=>a.songs.map(s=><div className="song"><small>{a.name}</small><b>{s}</b><span>{a.flag} {a.country}</span></div>))}</section><EventList events={filtered}/></>}
   {view==="timeline"&&<><section className="section-head"><div><p className="eyebrow">2020 → 2029</p><h2>Línea temporal</h2></div></section><EventList events={filtered}/></>}
   {view==="countries"&&<section className="countries">{[...new Set(catalog.map(a=>a.country).filter(Boolean))].map(c=><div className="country"><span>{catalog.find(a=>a.country===c)?.flag || "🌍"}</span><b>{c}</b><small>{catalog.filter(a=>a.country===c).length} artistas · década 2020</small></div>)}</section>}
  </main><footer><span>ICHKOMME / TRACKER</span><span>Datos organizados por artista · año · país · evento</span></footer>
 </div>
}
function EventList({events}){return <div className="events">{events.map(e=><div className="event"><strong>{e.year}</strong><span className={"event-type "+e.type}>{e.type}</span><b>{e.title}</b><span>{e.artist}</span><span>{e.country}</span></div>)}</div>}
export default App;