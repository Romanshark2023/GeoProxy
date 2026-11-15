const $ = selector => document.querySelector(selector);
const coordinates = point => 'Latitude ' + Math.abs(point.lat).toFixed(3) + (point.lat < 0 ? '°S' : '°N') + ' · Longitude ' + Math.abs(point.lon).toFixed(3) + (point.lon < 0 ? '°W' : '°E');
const features = [
  ['relief_m','Relief','m'], ['slope_deg','Median slope','°'], ['roughness_m','Roughness','m'],
  ['isolation','Isolation','km'], ['crew','Crew climate fit','°C'], ['rover','Rover surface openness','%']
];
const terrain = features.slice(0,3);
const defaults = [3,3,3,1,1,1];
let weights = [...defaults], goal = 100, data, target, rows = [], chosen, body;
const globe = createGlobe($('#sphere'), $('#caption'));
let saved = [];
try { saved = JSON.parse(localStorage.getItem('geoproxy-comparisons-v1') || '[]'); } catch {}
if (!Array.isArray(saved)) saved = [];
function place(c) { return [c.place?.name && 'Near ' + c.place.name,c.place?.admin1,c.place?.country].filter(Boolean).join(', ') || coordinates(c); }
function score(c) {
  let squared = 0, terrainWeight = 0;
  const scores = terrain.map(([key], i) => {
    const e = c.features_500m?.[key], t = target.features_500m?.[key];
    if (!Number.isFinite(e) || !Number.isFinite(t)) return null;
    const eps = data.method.eps[key];
    const z = Math.log10((e + eps)/(t + eps)) / data.method.earth_variability_scale[key];
    squared += weights[i] * z*z;
    terrainWeight += weights[i];
    return 100*Math.exp(-Math.abs(z));
  });
  const distance = c.place?.distance_km, temp = c.climate?.temp_mean_c, bare = c.bare_ground?.fraction;
  scores.push(Number.isFinite(distance) ? 100*Math.min(1,distance/goal) : null,
    Number.isFinite(temp) ? 100*Math.exp(-Math.abs(temp-15)/20) : null,
    Number.isFinite(bare) ? 100*bare : null);
  const subtotal = terrainWeight ? 100*Math.exp(-Math.sqrt(squared/terrainWeight)) : null;
  let sum = (subtotal || 0)*terrainWeight, used = terrainWeight;
  for (let i=3;i<scores.length;i++) if (scores[i] !== null) {sum += scores[i]*weights[i];used += weights[i];}
  return {c,scores,subtotal,total:used ? sum/used : null};
}
const pct = v => Number.isFinite(v) ? v.toFixed(2)+'%' : 'Unavailable';
const measure = (v,u) => Number.isFinite(v) ? v.toFixed(2)+' '+u : 'Unavailable';
function showGlobe() { if(chosen) globe.show(body,body==='earth'?chosen.c:target); }
let searchTimer;
function cancelSearch() {
  clearTimeout(searchTimer);
  globe.stopFlight();
  $('.flight-stage').classList.remove('scanning');
}
function flyToBest() {
  cancelSearch();
  const best = rows[0];
  if (!best) return;
  $('#flight-title').textContent = target.name;
  $('#flight-status').textContent = 'Comparing ' + rows.length + ' eligible Earth candidates';
  $('.flight-stage').classList.add('scanning');
  searchTimer = setTimeout(() => {
    $('.flight-stage').classList.remove('scanning');
    body = 'earth';
    $('#flight-title').textContent = place(best.c);
    $('#flight-status').textContent = 'Rotating to the highest-ranked sample…';
    globe.land(best.c, () => {
      $('#flight-status').textContent = 'Highest-ranked match · ' + pct(best.total) + ' · ' + coordinates(best.c);
    });
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
}
function drawScores(scores) {
  $('#score-bars').replaceChildren();
  scores.forEach((score, index) => {
    const row = document.createElement('div');
    const label = document.createElement('span');
    const value = document.createElement('strong');
    const bar = document.createElement('progress');
    label.textContent = features[index][1] + (weights[index] ? '' : ' (off)');
    bar.max = 100; bar.value = score ?? 0;
    bar.setAttribute('aria-label', label.textContent);
    value.textContent = pct(score);
    row.append(label, bar, value);
    $('#score-bars').append(row);
  });
}
function details() {
  const {c,scores,total,subtotal}=chosen;
  drawScores(scores);
  const values=[...terrain.map(([key])=>c.features_500m?.[key]),c.place?.distance_km,c.climate?.temp_mean_c,Number.isFinite(c.bare_ground?.fraction)?100*c.bare_ground.fraction:null];
  const references=[...terrain.map(([key,u,unit])=>measure(target.features_500m?.[key],unit)),goal+' km or farther','15 °C preference','100% bare/sparse'];
  $('#detail').innerHTML='<h2></h2><p class="legend"></p><h3>Overall match '+pct(total)+'</h3><table class="comparison"><thead><tr><th>Criterion</th><th>Target / preference</th><th>Earth</th><th>Score</th></tr></thead><tbody>'+features.map(([key,name,unit],i)=>'<tr><th>'+name+'</th><td>'+references[i]+'</td><td>'+measure(values[i],unit)+'</td><td>'+pct(scores[i])+(weights[i]===0?' · off':'')+'</td></tr>').join('')+'</tbody></table><p>Terrain subtotal '+pct(subtotal)+'</p><p class="legend">Crew climate uses annual mean Earth temperature. Rover openness describes land cover. Local hazards and vehicle performance require field measurements.</p><a target="_blank" rel="noopener">Map the sample center ↗</a>';
  $('#detail h2').textContent=place(c);
  $('#detail .legend').textContent=coordinates(c)+' · 20 × 20 km sample';
  $('#detail a').href='https://www.openstreetmap.org/?mlat='+c.lat+'&mlon='+c.lon+'#map=10/'+c.lat+'/'+c.lon;
  const url = new URL('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi');
  const halfLat = 10 / 111.32, halfLon = halfLat / Math.cos(c.lat * Math.PI / 180);
  url.search = new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:'MODIS_Terra_CorrectedReflectance_TrueColor',STYLES:'',FORMAT:'image/jpeg',SRS:'EPSG:4326',BBOX:[c.lon-halfLon,c.lat-halfLat,c.lon+halfLon,c.lat+halfLat].join(','),WIDTH:512,HEIGHT:512,TIME:'2024-01-15'});
  const link = document.createElement('a'); link.href=url.href; link.target='_blank'; link.rel='noopener';
  link.className='satellite-frame';
  const photo = new Image(); photo.loading='lazy'; photo.className='mapimage'; photo.alt='Terra MODIS satellite view of the Earth sample, January 15, 2024';
  photo.onerror=()=>{ link.textContent='Open NASA GIBS satellite image ↗'; }; photo.src=url.href; link.append(photo); $('#detail').append(link);
  if(target.id==='shackleton-crater'){
    const illumination=document.createElement('a');illumination.href='data/shackleton.png';illumination.target='_blank';illumination.rel='noopener';illumination.textContent='View lunar south pole illumination map ↗';$('#detail').append(illumination);
  }
  const note=text=>{const p=document.createElement('p');p.textContent=text;$('#detail').append(p);};
  note('Discovery dataset v'+data.schema_version+' · '+(c.landform?'Landform: '+c.landform.earth+' versus '+c.landform.target+' ('+c.landform.verdict+').':'Landform verdict unavailable in this export.'));
  if(target.id.includes('elysium'))note('Elysium slope and roughness approach the measurement limit; interpret this match cautiously.');
  for(const [key,v] of Object.entries(literature[target.id]||{}))note(key.replace('temp_', '').replace('_c','')+' temperature: '+v.value+' °C. '+v.citation);
  if(literature[target.id])note('Planetary temperatures are context only: lunar surface, Martian near-surface air and Earth air measurements differ.');
  $('#save-site').textContent='Save comparison';
  showGlobe();
}
function rank(preferred) {
  cancelSearch();
  rows=target.candidates.filter(c=>!c.excluded).map(score).sort((a,b)=>(b.total??-1)-(a.total??-1));
  chosen=rows.find(r=>r.c===preferred)||rows[0];
  $('#flight-title').textContent = place(chosen.c);
  $('#flight-status').textContent = 'Rank ' + (rows.indexOf(chosen)+1) + ' · ' + pct(chosen.total) + ' · ' + coordinates(chosen.c);
  $('#results').replaceChildren();
  rows.forEach((row,i)=>{
    const b=document.createElement('button');b.className='result'+(row===chosen?' active':'');
    const title=document.createElement('span');title.textContent=(i+1)+'. '+place(row.c);
    const value=document.createElement('strong');value.className='score';value.textContent=pct(row.total);
    b.append(title,value);b.onclick=()=>{body='earth';rank(row.c);};$('#results').append(b);
  });
  $('#count').textContent=data.scope.valid_land_windows.toLocaleString()+' Earth windows screened · '+rows.length+' eligible candidates · '+(target.candidates.length-rows.length)+' excluded';
  details();
}
function selectTarget(id) {
  target=data.targets.find(t=>t.id===id)||data.targets[0];
  $('#target').value=target.id;body=target.body;rank();
}
function controls(){
  $('#weight-controls').replaceChildren();
  features.forEach(([,name],i)=>{
    const label=document.createElement('label'), input=document.createElement('input'), out=document.createElement('output');
    label.textContent=name;input.type='range';input.min=0;input.max=5;input.value=weights[i];out.value=weights[i];
    input.oninput=()=>{weights[i]=Number(input.value);out.value=input.value;if(weights.every(w=>!w)){weights[i]=1;input.value=1;out.value=1;}rank();};
    label.append(input,out);$('#weight-controls').append(label);
  });$('#distance-goal').value=goal;
}
function persist(){try{localStorage.setItem('geoproxy-comparisons-v1',JSON.stringify(saved));return true;}catch{return false;}}
function savedList(){
  $('#saved-list').replaceChildren();
  if(!saved.length)$('#saved-list').textContent='Choose an Earth candidate and select Save comparison.';
  saved.forEach((s,i)=>{
    const region=data.targets.find(t=>t.id===s.target);
    const c=region?.candidates.find(c=>c.lat===s.lat&&c.lon===s.lon);
    if(!c)return;
    const div=document.createElement('div'),open=document.createElement('button'),remove=document.createElement('button');
    open.textContent=region.name+' → '+place(c)+' · '+pct(s.total);
    open.onclick=()=>{weights=[...s.weights];goal=s.goal;controls();selectTarget(region.id);rank(c);location.hash='explorer';};
    remove.textContent='Remove';remove.onclick=()=>{saved.splice(i,1);persist();savedList();};div.append(open,remove);$('#saved-list').append(div);
  });
}
function tabs(){
  const hash=location.hash;
  const panel={'#weights':'weight-panel','#saved':'saved-panel'}[hash]||'ranked';
  for(const id of ['ranked','weight-panel','saved-panel'])$('#'+id).hidden=id!==panel;
  document.querySelectorAll('.match-tabs a').forEach(a=>a.toggleAttribute('aria-current',a.hash===(panel==='ranked'?'#explorer':hash)));
  if(!data)return;
  if(hash==='#moon'&&target.body!=='moon'){selectTarget(data.targets.find(t=>t.body==='moon').id);flyToBest();}
  if(!['#explorer','#moon'].includes(hash))cancelSearch();
  if(panel==='saved-panel')savedList();
}
$('#save-site').onclick=()=>{
  const snapshot={target:target.id,lat:chosen.c.lat,lon:chosen.c.lon,weights:[...weights],goal,total:chosen.total};
  if(!saved.some(s=>JSON.stringify(s)===JSON.stringify(snapshot)))saved.push(snapshot);
  $('#save-site').textContent=persist()?'Saved ✓':'Saved for this visit';
};
$('#target').onchange=()=>{
  if($('#target').value.startsWith('region:')){
    document.dispatchEvent(new CustomEvent('open-region',{detail:$('#target').value.slice(7)}));
    $('#target').value=target.id;
    return;
  }
  selectTarget($('#target').value);location.hash='explorer';flyToBest();};
$('#distance-goal').onchange=e=>{goal=Math.min(1000,Math.max(1,Number(e.target.value)||100));e.target.value=goal;rank();};
$('#reset-model').onclick=()=>{weights=[...defaults];goal=100;controls();rank();};
function manualView() {
  cancelSearch();
  $('#flight-title').textContent = body==='earth' ? place(chosen.c) : target.name;
  $('#flight-status').textContent = body==='earth' ? coordinates(chosen.c) : coordinates(target);
}
$('#sphere').addEventListener('pointerdown',manualView);
$('#sphere').addEventListener('keydown',manualView);
$('#recenter').onclick=()=>{manualView();globe.recenter();};
$('#earth-view').onclick=()=>{body='earth';manualView();showGlobe();};
$('#planet-view').onclick=()=>{body=target.body;manualView();showGlobe();};
window.addEventListener('hashchange',tabs);
let literature={};
fetch('data/literature.json').then(r=>r.json()).then(v=>{literature=v;if(chosen)rank();}).catch(()=>{});
fetch('data/discoveries.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{
  data=d;$('#atlas').replaceChildren();
  for(const t of data.targets){
    $('#target').add(new Option(t.body.toUpperCase()+' · '+t.name,t.id));
    const a=document.createElement('a');a.href='#explorer';a.className='target-card';
    const img=document.createElement('img');img.src=t.body==='moon'?'data/moon.jpg':'data/mars-relief.jpg';img.alt='';
    const title=document.createElement('strong');title.textContent=t.name;
    const coord=document.createElement('small');coord.className='target-coord';coord.textContent=t.body+' · '+coordinates(t);
    const span=document.createElement('span');span.append(title,coord);a.append(img,span);a.onclick=()=>{selectTarget(t.id);flyToBest();};$('#atlas').append(a);
  }
  controls();selectTarget(data.targets[0].id);tabs();if(location.hash==='#explorer')flyToBest();
}).catch(()=>{$('#count').textContent='The discovery results could not load. Reload to try again.';});
