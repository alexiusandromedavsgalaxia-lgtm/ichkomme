import React, {useEffect, useMemo, useState} from "react";

const featuredMeta = {
  "erika vikman": {
    country:"Finland", flag:"🇫🇮", color:"pink", eurovision:"2025",
    photo:"https://commons.wikimedia.org/wiki/Special:FilePath/Erika%20Vikman%20at%20ESC2025%20for%20Finland%2042.jpg?width=900",
    photoCredit:"Wikimedia Commons / Quejaytee",
    bio:"Finnish pop artist who represented Finland at Eurovision 2025 with ICH KOMME.",
    songs:["ICH KOMME","Cicciolina","Syntisten pöytä","Ruoska"],
    tags:["Eurovision","Finland","Pop"]
  },
  "indila": {
    country:"France", flag:"🇫🇷", color:"violet", eurovision:"—",
    photo:"https://commons.wikimedia.org/wiki/Special:FilePath/Indila%20-%20EBBA%202015.jpg?width=900",
    photoCredit:"Wikimedia Commons / Suzanne Schols",
    bio:"French singer and songwriter known worldwide for her distinctive voice and francophone pop sound.",
    songs:["Dernière danse","Tourner dans le vide","Love Story","Ainsi bas la vida"],
    tags:["France","Pop","Francophone"]
  },
  "antigoni": {
    country:"Cyprus", flag:"🇨🇾", color:"gold", eurovision:"2026",
    photo:"https://commons.wikimedia.org/wiki/Special:FilePath/Antigoni%20performing%20JALLA%20representing%20Cyprus%20in%20the%20Grand%20Final%20of%20the%202026%20Eurovision%20Song%20Contest%20in%20Vienna%2002.jpg?width=900",
    photoCredit:"Wikimedia Commons",
    bio:"Cypriot-British singer and songwriter who represented Cyprus at Eurovision 2026 with JALLA.",
    songs:["JALLA","Yala","Dímelo","Stuck"],
    tags:["Eurovision","Cyprus","Pop"]
  },
  "marina satti": {
    country:"Greece", flag:"🇬🇷", color:"green", eurovision:"2024",
    photo:"https://commons.wikimedia.org/wiki/Special:FilePath/Marina%20Satti.jpg?width=900",
    photoCredit:"Wikimedia Commons / Arkland",
    bio:"Greek singer, songwriter and producer whose music blends Greek, Balkan and urban influences.",
    songs:["ZARI","MANTISSA","TUCUTUM","LALALALA"],
    tags:["Eurovision","Greece","Greek pop"]
  },
  "kaj": {
    country:"Sweden / Finland", flag:"🇸🇪", color:"blue", eurovision:"2025",
    photo:"https://commons.wikimedia.org/wiki/Special:FilePath/KAJ%20at%20ESC2025%20for%20Sweden%2013.jpg?width=900",
    photoCredit:"Wikimedia Commons",
    bio:"Finnish-Swedish comedy music group that represented Sweden at Eurovision 2025 with Bara bada bastu.",
    songs:["Bara bada bastu","Freestyler","Bonfire"],
    tags:["Eurovision","Sweden","Finland","Humor"]
  }
};

const years = Array.from({length:10},(_,i)=>2020+i);

function enrichArtist(a){
  const meta=featuredMeta[String(a.name||"").trim().toLowerCase()]||{};
  return {
    ...meta,...a,id:a.id??a.name,name:a.name||"Unknown artist",
    country:a.country||meta.country||"International",flag:a.flag||meta.flag||flagForCountry(a.country)||"🌍",
    color:a.color||meta.color||"violet",photo:a.photo||meta.photo||"",photoCredit:a.photoCredit||meta.photoCredit||"",
    bio:a.bio||meta.bio||"Community-submitted artist profile.",eurovision:a.eurovision||meta.eurovision||"—",
    songs:Array.isArray(a.songs)&&a.songs.length?a.songs:meta.songs||[],tags:Array.isArray(a.tags)&&a.tags.length?a.tags:meta.tags||[]
  };
}
function flagForCountry(country){
  const c=String(country||"").toLowerCase();
  if(c.includes("finland")) return "🇫🇮"; if(c.includes("sweden")) return "🇸🇪"; if(c.includes("france")) return "🇫🇷";
  if(c.includes("greece")) return "🇬🇷"; if(c.includes("cyprus")) return "🇨🇾"; if(c.includes("spain")) return "🇪🇸";
  if(c.includes("italy")) return "🇮🇹"; if(c.includes("uk")) return "🇬🇧"; if(c.includes("united states")||c.includes("usa")) return "🇺🇸";
  return "🌍";
}

function App(){
 const [artist,setArtist]=useState("all"),[year,setYear]=useState("all"),[query,setQuery]=useState(""),[view,setView]=useState("overview");
 const [remoteArtists,setRemoteArtists]=useState([]),[remoteEvents,setRemoteEvents]=useState([]),[songs,setSongs]=useState([]),[dbError,setDbError]=useState(""),[dbReady,setDbReady]=useState(false);
 const [showAdd,setShowAdd]=useState(false),[notice,setNotice]=useState(""),[submitting,setSubmitting]=useState(false),[selectedSong,setSelectedSong]=useState(null);

 const loadSongs=async()=>{
   try{
     const r=await fetch("/api/songs");
     const data=await r.json();
     if(!r.ok)throw new Error(data.error||"Song API error");
     setSongs(data.songs||[]);
   }catch(e){
     setSongs([]);
   }
 };

 const loadCatalog=async()=>{
   setDbError("");
   try{const r=await fetch("/api/artists");const data=await r.json();if(!r.ok)throw new Error(data.error||"API error");
     setRemoteArtists(data.artists||[]);setRemoteEvents(data.events||[]);setDbReady(true);
   }catch(e){setDbReady(false);setDbError(e.message||"Database connection failed");}
 };
 useEffect(()=>{loadCatalog();loadSongs();},[]);
 const catalog=useMemo(()=>remoteArtists.map(enrichArtist),[remoteArtists]),eventCatalog=remoteEvents;
 const selected=catalog.find(a=>String(a.id)===String(artist));
 const filtered=useMemo(()=>eventCatalog.filter(e=>
   (artist==="all"||String(e.artistId||"")===String(artist)||String(e.artist||"").toLowerCase()===String(selected?.name||"").toLowerCase()) &&
   (year==="all"||String(e.year)===year) &&
   [e.title,e.artist,e.country,e.venue,e.type].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
 ),[eventCatalog,artist,year,query,selected]);
 const allCountries=[...new Set(catalog.map(a=>a.country).filter(Boolean))];
 const filteredSongs=useMemo(()=>songs.filter(s=>
   (artist==="all"||String(s.artist||"").toLowerCase()===String(selected?.name||"").toLowerCase()) &&
   (year==="all"||String(s.year||"")===year) &&
   [s.title,s.artist,s.year,s.credits].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
 ),[songs,artist,year,query,selected]);
 const artistSongs=useMemo(()=>songs.filter(s=>String(s.artist||"").toLowerCase()===String(selected?.name||"").toLowerCase()),[songs,selected]);

 async function submitArtist(form){
   setSubmitting(true);setNotice("");
   try{const payload=Object.fromEntries(new FormData(form).entries());
     const r=await fetch("/api/artists",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
     const data=await r.json();if(!r.ok)throw new Error(data.error||"Could not add artist");
     await loadCatalog();setShowAdd(false);setNotice("Artist added to the community directory.");setArtist(data.artist.id);setView("artists");form.reset();
   }catch(e){setNotice(e.message||"Could not add artist.");}finally{setSubmitting(false);}
 }

 return <div className="shell">
  <header>
   <a className="brand" href="#" onClick={e=>{e.preventDefault();setView("overview");setArtist("all")}}><img src="/logo.svg" alt="ICHKOMME"/><span>ARTIST DATABASE</span></a>
   <nav>{[["overview","HOME"],["artists","ARTISTS"],["songs","SONGS"],["timeline","TIMELINE"],["countries","COUNTRIES"]].map(([key,label])=><button key={key} className={view===key?"active":""} onClick={()=>setView(key)}>{label}</button>)}</nav>
   <button className="add-top" onClick={()=>setShowAdd(true)}>＋ ADD ARTIST</button>
   <div className="status"><i/>{dbReady?"D1 CONNECTED":"D1 OFFLINE"}</div>
  </header>
  <main>
   {dbError&&<div className="db-error">CLOUDFLARE D1 · {dbError}</div>}
   {!dbReady&&!dbError&&<div className="db-error">CONNECTING TO CLOUDFLARE D1…</div>}
   {notice&&<div className="notice">{notice}</div>}
   <section className="hero"><div><p className="eyebrow">MUSIC · EUROVISION · THE 2020s</p><h1>Track the artists.<br/><em>Follow the era.</em></h1><p className="lead">A living music database for songs, concerts, Eurovision appearances, countries and moments across the 2020s.</p><div className="hero-actions"><button className="primary" onClick={()=>setView("artists")}>EXPLORE ARTISTS</button><button className="ghost" onClick={()=>setShowAdd(true)}>ADD YOUR ARTIST <span>↗</span></button></div></div><div className="orbit"><span>2020</span><b>2024</b><span>2025</span><strong>2026</strong></div></section>
   <section className="stats"><div><strong>{catalog.length}</strong><span>ARTISTS</span></div><div><strong>{eventCatalog.length}</strong><span>EVENTS</span></div><div><strong>{allCountries.length}</strong><span>COUNTRIES</span></div><div><strong>2020–29</strong><span>DECADE</span></div></section>
   <section className="controls"><div className="search-wrap"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search artists, songs, countries, events..." /></div><select value={artist} onChange={e=>setArtist(e.target.value)}><option value="all">All artists</option>{catalog.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><select value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></section>

   {view==="overview"&&<><section className="section-head"><div><p className="eyebrow">FEATURED DIRECTORY</p><h2>Artists in the database</h2></div><button className="link-button" onClick={()=>setView("artists")}>VIEW ALL ↗</button></section><section className="artist-grid">{catalog.map(a=><ArtistCard key={a.id} artist={a} onClick={()=>{setArtist(a.id);setView("artists")}}/>)}</section><section className="section-head"><div><p className="eyebrow">DECADE LOG</p><h2>Recent activity</h2></div><span>{filtered.length} events</span></section><EventList events={filtered}/></>}

   {view==="artists"&&<><section className="section-head"><div><p className="eyebrow">{selected?"ARTIST PROFILE":"ARTIST DIRECTORY"}</p><h2>{selected?selected.name:"Artists"}</h2></div><button className="link-button" onClick={()=>setShowAdd(true)}>＋ ADD ARTIST</button></section>{selected?<ArtistProfile artist={selected}/>:<section className="artist-grid">{catalog.map(a=><ArtistCard key={a.id} artist={a} onClick={()=>setArtist(a.id)}/>)}</section>}{selected&&<><section className="section-head"><div><p className="eyebrow">SONGBOOK</p><h2>Known songs</h2></div></section><section className="song-grid">{artistSongs.length?<SongGrid songs={artistSongs} onSelect={setSelectedSong}/>:selected.songs.map((s,i)=><div className="song song-clickable" key={s+i} tabIndex="0" role="button" onClick={()=>setSelectedSong({title:s,artist:selected.name})} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedSong({title:s,artist:selected.name})}}}><small>{selected.name}</small><b>{s}</b><span>{selected.flag} {selected.country}</span><span className="song-open">OPEN SONG ↗</span></div>)}</section><section className="section-head"><div><p className="eyebrow">APPEARANCES</p><h2>Recorded activity</h2></div></section><EventList events={filtered}/></>}</>}

   {view==="songs"&&<><section className="section-head"><div><p className="eyebrow">SONG DATABASE · D1 SONGSAVE</p><h2>All songs</h2></div><span>{filteredSongs.length} songs</span></section><SongGrid songs={filteredSongs} onSelect={setSelectedSong}/></>}

   {view==="timeline"&&<><section className="section-head"><div><p className="eyebrow">2020 → 2029</p><h2>The decade timeline</h2></div><span>{filtered.length} events</span></section><EventList events={filtered}/></>}
   {view==="countries"&&<><section className="section-head"><div><p className="eyebrow">GEOGRAPHY</p><h2>Countries represented</h2></div></section><section className="countries">{allCountries.map(c=><div className="country" key={c}><span>{flagForCountry(c)}</span><b>{c}</b><small>{catalog.filter(a=>a.country===c).length} artists in the directory</small></div>)}</section></>}
  </main>
  <footer><span>ICHKOMME / ARTIST DATABASE</span><span>Community profiles · decade tracking · music history</span></footer>

  {selectedSong&&<SongModal song={selectedSong} onClose={()=>setSelectedSong(null)}/>}\n\n  {showAdd&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setShowAdd(false)}><form className="modal" onSubmit={e=>{e.preventDefault();submitArtist(e.currentTarget)}}>
    <div className="modal-head"><div><p className="eyebrow">COMMUNITY DIRECTORY</p><h2>Add an artist</h2></div><button type="button" className="close" onClick={()=>setShowAdd(false)}>×</button></div>
    <p className="modal-copy">Add a singer or group to the shared D1 directory. The profile will be visible to everyone using the site.</p>
    <div className="form-grid">
      <label>Artist / group name<input name="name" required maxLength="100" placeholder="e.g. Chappell Roan"/></label>
      <label>Country<input name="country" required maxLength="80" placeholder="e.g. United States"/></label>
      <label>Photo URL<input name="photo" type="url" placeholder="https://..."/></label>
      <label>Eurovision year<input name="eurovision" maxLength="20" placeholder="2025 or leave blank"/></label>
      <label className="wide">Short bio<textarea name="bio" maxLength="600" rows="3" placeholder="A short description of the artist..."/></label>
      <label className="wide">Songs <span>comma separated</span><input name="songs" maxLength="600" placeholder="Song One, Song Two, Song Three"/></label>
      <label className="wide">Tags <span>comma separated</span><input name="tags" maxLength="300" placeholder="Pop, Eurovision, France"/></label>
    </div>
    {notice&&<div className="form-notice">{notice}</div>}
    <div className="modal-actions"><button type="button" className="ghost" onClick={()=>setShowAdd(false)}>CANCEL</button><button className="primary" disabled={submitting}>{submitting?"ADDING…":"ADD TO DATABASE"}</button></div>
  </form></div>}
 </div>
}

function ArtistCard({artist,onClick}){
 return <article className={"artist "+artist.color} onClick={onClick}>
  <div className="artist-photo">{artist.photo?<img src={artist.photo} alt={artist.name} loading="lazy"/>:<div className="portrait">{artist.name.split(" ").map(x=>x[0]).join("")}</div>}<div className="photo-shade"/></div>
  <div className="artist-meta"><span>{artist.flag} {artist.country}</span><span>{artist.eurovision!=="—"?"ESC "+artist.eurovision:"ARTIST"}</span></div>
  <div className="artist-copy"><h3>{artist.name}</h3><p>{artist.bio}</p><div className="chips">{artist.tags.slice(0,4).map(t=><span key={t}>{t}</span>)}</div></div><span className="card-arrow">↗</span>
 </article>
}

function ArtistProfile({artist}){
 return <section className="profile"><div className="profile-photo">{artist.photo?<img src={artist.photo} alt={artist.name}/>:<div className="portrait">{artist.name.split(" ").map(x=>x[0]).join("")}</div>}</div><div className="profile-info"><p className="eyebrow">{artist.flag} {artist.country} · {artist.eurovision!=="—"?"EUROVISION "+artist.eurovision:"MUSIC ARTIST"}</p><h2>{artist.name}</h2><p className="profile-bio">{artist.bio}</p><div className="profile-facts"><span><b>{artist.songs.length}</b> songs</span><span><b>{artist.tags.length}</b> tags</span><span><b>{artist.community?"COMMUNITY":"FEATURED"}</b> profile</span></div>{artist.photoCredit&&<small className="credit">Photo: {artist.photoCredit}</small>}</div></section>
}

function SongGrid({songs,onSelect}){
 if(!songs.length)return <div className="empty">No matching songs in the database yet.</div>;
 return <div className="song-database-grid">{songs.map(song=><article className="song song-record song-clickable" key={song.id} tabIndex="0" role="button" onClick={()=>onSelect(song)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(song)}}}>
   <div className="song-record-top"><small>{song.artist}</small>{song.year&&<span>{song.year}</span>}</div>
   <b>{song.title}</b>
   {song.credits&&<p>{song.credits}</p>}
   <span className="song-open">OPEN SONG ↗</span>
 </article>)}</div>
}

function SongModal({song,onClose}){
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
   <section className="modal song-modal">
     <div className="modal-head"><div><p className="eyebrow">SONG</p><h2>{song.title}</h2><p className="modal-copy">{song.artist}{song.year?" · "+song.year:""}</p></div><button type="button" className="close" onClick={onClose}>×</button></div>
     {song.credits&&<p className="modal-copy">{song.credits}</p>}
     {song.audio_url&&<audio className="song-audio" controls preload="none" src={song.audio_url}/>}
     {song.video_embed_url?<div className="song-modal-video"><iframe src={song.video_embed_url} title={song.title+" · "+song.artist} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>:<div className="song-no-video">VIDEO NOT LINKED YET</div>}
     {!song.audio_url&&!song.video_embed_url&&<div className="empty">This song has been added to the database, but no playable media is linked yet.</div>}
   </section>
 </div>
}

function EventList({events}){
 if(!events.length)return <div className="empty">No matching events in the database yet.</div>;
 return <div className="events">{events.map((e,i)=><div className="event" key={e.id||e.year+"-"+e.title+"-"+i}><strong>{e.year||"—"}</strong><span className={"event-type "+String(e.type||"event").toLowerCase()}>{e.type||"event"}</span><b>{e.title}</b><span>{e.artist||"—"}</span><span>{e.country||"—"}</span></div>)}</div>
}

export default App;
