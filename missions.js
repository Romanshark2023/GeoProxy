(() => {
  const el = id => document.getElementById(id);
  const canvas = el('mission-globe');
  const atlas = createGlobe(canvas, el('mission-caption'), true);
  const matches = {perseverance:'jezero-crater',curiosity:'gale-crater',insight:'elysium-insight','apollo-11':'apollo-11-tranquillitatis',shackleton:'shackleton-crater'};
  let regionalData;
  let records = [], pictures = new Map();
  const group = outcome => outcome==='operating' ? 'Active' : ['planned','in-development'].includes(outcome) ? 'Planned' : 'Historical';
  const mapped = s => Number.isFinite(s.lat) && Number.isFinite(s.lon);
  function readPosition(surface, prefix) {
    surface.addEventListener('globecenter', e => {el(prefix+'-center').textContent='Globe center · '+coordinates(e.detail);});
    surface.addEventListener('globehover', e => {
      const {point,sites}=e.detail;
      el(prefix+'-hover').textContent = point ? 'Pointer · '+coordinates(point)+(sites.length?' · '+sites[0].name:'') : 'Point at the surface for coordinates.';
    });
    surface.addEventListener('globepick',e=>{
      const nearby=e.detail;
      el('mission-world').value=nearby[0].body;
      if(prefix==='flight')el('mission-status').value='All';
      location.hash='missions';
      fill(nearby[0].slug);
      const options=el('pick-options');options.replaceChildren();
      if(nearby.length>1){
        options.append('Nearby markers ');
        for(const site of nearby){
          const button=document.createElement('button');button.textContent=site.name;
          button.onclick=()=>{el('mission-list').value=site.slug;inspect(site);};options.append(button);
        }
      }
    });
  }
  function link(text,url) {
    const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener';return a;
  }
  function inspect(site) {

    const world=el('mission-world').value;
    atlas.show(world,mapped(site)?site:{lat:0,lon:0},mapped(site));
    canvas.setAttribute('aria-label',world+' globe with selectable mission markers');
    el('mission-name').textContent=site.name;
    el('mission-description').textContent=[site.group,site.outcome,site.operator,site.site_name||site.status,
      mapped(site)?coordinates(site):'No fixed surface coordinate in this catalog.'].filter(Boolean).join(' · ');
    const links=el('mission-links');links.replaceChildren(link('Mission source ↗',site.url));
    if(site.coordinate_source)links.append(link('Coordinate source ↗',site.coordinate_source));
    const region=regionalData.regions[site.body+'/'+site.slug];
    el('regional-matches').replaceChildren();
    if(region && !matches[site.slug]){
      const panel=el('regional-matches');
      const h=document.createElement('h3');h.textContent='Earth terrain matches';panel.append(h);
      const explanation=document.createElement('p');
      explanation.textContent='Local elevation search · '+regionalData.windows.toLocaleString()+' sampled Earth windows. Target relief '+region.relief+' m, median slope '+region.slope+'°. Five closest centers, highest score first.';
      panel.append(explanation);
      const list=document.createElement('ol');
      for(const row of region.rows){
        const item=document.createElement('li');
        item.append(link(coordinates(row),'https://www.openstreetmap.org/?mlat='+row.lat+'&mlon='+row.lon+'#map=9/'+row.lat+'/'+row.lon));
        const scores=document.createElement('small');
        scores.textContent='Overall '+row.total+'% · Relief '+row.relief+' m ('+row.scores[0]+'%) · Slope '+row.slope+'° ('+row.scores[1]+'%)';item.append(scores);list.append(item);
      }
      panel.append(list);
      const method=document.createElement('details');
      method.innerHTML='<summary>Sampling and limitations</summary><p>Each 60 × 60 km window uses 49 elevation samples spaced 10 km apart. Earth centers lie on a 2° grid from 60°S to 80°N. Windows with missing or nonpositive Earth elevations are excluded. Relief is P90 minus P10. Each log(1 + feature) difference is divided by its Earth sample standard deviation. Overall fit is 100 × exp(−RMS difference), with equal weights on relief and slope. These exploratory terrain scores use a different footprint and feature set from the five detailed searches.</p><p>Sources: local MOLA MEGDR for Mars, LRO LOLA 80 m south-polar DEM for the Moon and GMT Earth Relief 5 arc-minute grid for Earth. Source interpolation and coarse sampling limit interpretation.</p>';
      panel.append(method);
    }
    if(matches[site.slug]){
      const a=document.createElement('a');a.href='#explorer';a.textContent='Find regional Earth matches →';
      a.onclick=()=>{if(data){selectTarget(matches[site.slug]);flyToBest();}};links.append(a);
    }else if(mapped(site) && !region){
      const note=document.createElement('small');note.textContent='Earth ranking pending terrain processing for this region.';links.append(note);
    }
    const fig=el('mission-photo');fig.replaceChildren();
    const photo=pictures.get(site.slug);
    if(!photo && mapped(site)) {
      // Overlay the actual location on the complete mosaic; regional-scale context only.
      const overview=document.createElement('div');overview.className='orbital-map';
      const image=new Image();image.src=world==='moon'?'data/moon.jpg':'data/viking-orbital.jpg';
      image.alt='Global orbital mosaic with the selected location marked';
      const dot=document.createElement('span');
      dot.style.left=((site.lon+180)/360*100)+'%';dot.style.top=((90-site.lat)/180*100)+'%';
      overview.append(image,dot);fig.append(overview);
      const caption=document.createElement('figcaption');
      caption.append(link(world==='moon'?'Lunar orbital context · NASA LROC ↗':'Mars orbital context · NASA Viking / ASU ↗',
        world==='moon'?'https://svs.gsfc.nasa.gov/4720/':'https://www.mars.asu.edu/data/mdim_color/'));
      fig.append(caption);
    }
    if(photo){
      const a=link('',photo.image), img=new Image();img.alt=photo.caption;img.src=photo.image;a.append(img);
      const caption=document.createElement('figcaption');caption.append(photo.caption+' · ',link(photo.credit||'Image source',photo.source));fig.append(a,caption);
    } else links.append(link('Search NASA image archive ↗','https://images.nasa.gov/search?q='+encodeURIComponent(site.name+' '+world)));
  }
  function fill(preferred) {
    const world=el('mission-world').value, status=el('mission-status').value;
    const filtered=records.filter(s=>s.body===world&&(status==='All'||s.group===status));
    const pins=filtered.filter(mapped);atlas.setSites(pins);el('pick-options').replaceChildren();
    const select=el('mission-list');select.replaceChildren();
    for(const s of filtered)select.add(new Option(s.name+' · '+s.group+(mapped(s)?'':' · unlocated'),s.slug));
    el('mission-count').textContent=filtered.length+' records · '+pins.length+' mapped entries';
    const first=filtered.find(s=>s.slug===preferred)||pins[0]||filtered[0];
    if(first){select.value=first.slug;inspect(first);}
  }
  el('mission-list').onchange=e=>{el('pick-options').replaceChildren();inspect(records.find(s=>s.body===el('mission-world').value&&s.slug===e.target.value));};
  el('mission-world').onchange=()=>fill();el('mission-status').onchange=()=>fill();
  readPosition(canvas,'mission');readPosition(el('sphere'),'flight');
  const load=async file=>{const r=await fetch('data/'+file+'.json');if(!r.ok)throw Error(file);return r.json();};
  Promise.all(['moon-missions','moon-sites','mars-missions','mars-sites','mission-images','regional-terrain','polar-regions'].map(load)).then(([lm,ls,mm,ms,images,regional,polar])=>{
    regionalData=regional;
    pictures=new Map(images.map(i=>[i.id,i]));
    pictures.set('perseverance',{image:'data/jezero-navcam.jpg',caption:'Perseverance navigation camera · Sol 1699, Jezero mission terrain',credit:'NASA/JPL-Caltech',source:'https://mars.nasa.gov/mars2020/multimedia/raw-images/'});
    const maps=[['moon',lm.missions,ls.sites],['mars',mm.filter(m=>m.entry_kind!=='finding'&&m.entry_kind!=='analogue'),ms]];
    for(const [body,missions,sites] of maps){
      const merged=new Map(missions.map(m=>[m.slug,m]));
      for(const s of sites)merged.set(s.slug,{...merged.get(s.slug),...s});
      for(const m of merged.values())records.push({...m,body,lat:m.latitude,lon:m.longitude??m.longitude_east_180,
        operator:m.operator||m.entity,url:m.url||m.page,group:group(m.outcome)});
    }
    
    for(const [name,lat,lon] of polar)records.push({name:'Artemis · '+name,slug:'artemis-'+name,lat,lon,body:'moon',group:'Planned',site_name:'Representative study point in a candidate region. Final landing site pending.',url:'https://www.nasa.gov/mission/artemis-iv/',coordinate_source:'https://doi.org/10.1029/2025JE009434'});
    records.push({name:'Shackleton crater',slug:'shackleton',body:'moon',group:'Planned',lat:-89.67,lon:129.78,site_name:'Polar exploration study region',url:'https://planetarynames.wr.usgs.gov/Feature/5450'});
    pictures.set('shackleton',{image:'data/shackleton.png',caption:'Lunar south pole illumination map',credit:'NASA/LROC',source:'https://science.nasa.gov/resource/illumination-map-of-the-moons-south-pole/'});
    const oxia=records.find(s=>s.slug==='rosalind-franklin');if(oxia)Object.assign(oxia,{lat:18.2,lon:-24.7,site_name:'Oxia Planum · approximate target region',coordinate_source:'https://explorationscience.esa.int/project/exomars-rosalind-franklin-rfm/'});
    for(const world of ['moon','mars']){
      const group=document.createElement('optgroup'); group.label=(world==='moon'?'Moon':'Mars')+' · explorable sites';
      for(const site of records.filter(s=>s.body===world&&mapped(s)&&!matches[s.slug])){
        const key=world+'/'+site.slug;
        group.append(new Option(site.name+(regional.regions[key]?' · terrain matches':' · imagery'),'region:'+key));
      }
      el('target').append(group);
    }
    document.addEventListener('open-region',e=>{
      const [world,slug]=e.detail.split('/');
      el('mission-world').value=world;el('mission-status').value='All';fill(slug);location.hash='missions';
    });
    const home=el('home-regions');
    function syncChoices(){
      const prompt=new Option('Choose a region or mission site…','');
      home.replaceChildren(prompt,...Array.from(el('target').children,node=>node.cloneNode(true)));
      home.value='';
    }
    syncChoices();
    new MutationObserver(syncChoices).observe(el('target'),{childList:true});
    home.onchange=()=>{
      if(!home.value)return;
      el('target').value=home.value;el('target').dispatchEvent(new Event('change'));home.value='';
    };
    globe.setSites(records.filter(mapped));fill('apollo-11');
  }).catch(()=>{el('mission-count').textContent='Mission atlas unavailable. Reload to try again.';});
})();
