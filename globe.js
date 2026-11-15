/* Orthographic projection of the packaged equirectangular surface maps. */
function createGlobe(canvas, status, photographicMars = false) {
  const textures = {
    earth: { file: 'data/earth.jpg', west: -180, caption: 'NASA Blue Marble' },
    mars: { file: 'data/mars-relief.jpg', west: 0, caption: 'NASA MOLA · Elevation' },
    moon: { file: 'data/moon.jpg', west: -180, caption: 'NASA LROC · Surface imagery' }
  };
  if (photographicMars) textures.mars = {file:'data/viking-orbital.jpg',west:-180,caption:'NASA Viking Orbiter · ASU color mosaic'};
  let markCenter = true;
  const rad = Math.PI / 180;
  const size = canvas.width;
  const radius = size / 2;
  const context = canvas.getContext('2d');
  const frame = context.createImageData(size, size);
  const samples = [];
  // Cache surface normals and lighting once. Rotation only changes the texture lookup.
  for (let row = 0; row < size; row++) {
    const ny = (radius - row - 0.5) / radius;
    for (let col = 0; col < size; col++) {
      const nx = (col + 0.5 - radius) / radius;
      const depth = 1 - nx * nx - ny * ny;
      if (depth < 0) continue;
      const nz = Math.sqrt(depth);
      samples.push({ nx, ny, nz, offset: (row * size + col) * 4,
        light: .56 + .47 * Math.max(0, -.36 * nx + .32 * ny + .88 * nz) });
    }
  }
  let current, marker, latitude = 0, longitude = 0, drag, queued = false;

  let pins = [], visiblePins = [], world;
  function setSites(sites) { pins = sites; schedule(); }
  function emit(name, detail) { canvas.dispatchEvent(new CustomEvent(name, { detail })); }
  function pointAt(event) {
    const box = canvas.getBoundingClientRect();
    const x = 2 * (event.clientX-box.left)/box.width-1;
    const y = 1-2*(event.clientY-box.top)/box.height;
    const nz2 = 1-x*x-y*y;
    if (nz2<0) return null;
    const z=Math.sqrt(nz2), sin=Math.sin(latitude*rad), cos=Math.cos(latitude*rad);
    return {x:(1+x)*radius,y:(1-y)*radius,lat:Math.asin(Math.max(-1,Math.min(1,y*cos+z*sin)))/rad,
      lon:((longitude+Math.atan2(x,z*cos-y*sin)/rad+540)%360)-180};
  }
  function hit(point) {
    if (!point) return [];
    return visiblePins.map(p=>({site:p.site,d:Math.hypot(point.x-p.x,point.y-p.y)}))
      .filter(p=>p.d<=9).sort((a,b)=>a.d-b.d).map(p=>p.site);
  }
  function paint() {
    queued = false;
    if (!current?.pixels) return;
    const sin = Math.sin(latitude * rad), cos = Math.cos(latitude * rad);
    const { pixels, west } = current;
    for (const p of samples) {
      const lat = Math.asin(Math.min(1, Math.max(-1, p.ny * cos + p.nz * sin)));
      const lon = longitude + Math.atan2(p.nx, p.nz * cos - p.ny * sin) / rad;
      const x = Math.floor((((lon - west) % 360 + 360) % 360) * pixels.width / 360);
      const y = Math.min(pixels.height - 1, Math.floor((.5 - lat / Math.PI) * pixels.height));
      const source = 4 * (y * pixels.width + x);
      for (let k = 0; k < 3; k++) frame.data[p.offset + k] = pixels.data[source + k] * p.light;
      frame.data[p.offset + 3] = 255;
    }
    context.putImageData(frame, 0, 0);
    visiblePins=[];
    for (const site of pins) {
      if(site.body!==world) continue;
      const phi=site.lat*rad, dl=(site.lon-longitude)*rad;
      if(sin*Math.sin(phi)+cos*Math.cos(phi)*Math.cos(dl)<=0) continue;
      const x=radius*(1+Math.cos(phi)*Math.sin(dl)), y=radius*(1-cos*Math.sin(phi)+sin*Math.cos(phi)*Math.cos(dl));
      visiblePins.push({site,x,y});
      context.beginPath();context.arc(x,y,3.6,0,2*Math.PI);
      context.fillStyle=site.group==='Active'?'#99f597':site.group==='Planned'?'#ffc463':'#b5dfff';
      context.fill();context.strokeStyle='#172111';context.lineWidth=1;context.stroke();
    }
    emit('globecenter',{lat:latitude,lon:longitude});
    const lat = marker.lat * rad, delta = (marker.lon - longitude) * rad;
    const depth = sin * Math.sin(lat) + cos * Math.cos(lat) * Math.cos(delta);
    if (markCenter && depth > 0) {
      const x = radius * (1 + Math.cos(lat) * Math.sin(delta));
      const y = radius * (1 - cos * Math.sin(lat) + sin * Math.cos(lat) * Math.cos(delta));
      context.beginPath();
      context.arc(x, y, 4.5, 0, 2 * Math.PI);
      context.fillStyle = '#c3f483';
      context.strokeStyle = '#172111';
      context.lineWidth = 2;
      context.fill();
      context.stroke();
    }
  }

  function schedule() {
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }

  let flight;
  function stopFlight() { cancelAnimationFrame(flight); }

  function rotate(horizontal, vertical) {
    stopFlight();
    longitude = ((longitude + horizontal + 540) % 360 + 360) % 360 - 180;
    latitude = Math.max(-90, Math.min(90, latitude + vertical));
    schedule();
  }

  canvas.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, startX:event.clientX,startY:event.clientY,moved:false,x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    const point=pointAt(event);
    emit('globehover',{point,sites:hit(point)});
    if (drag?.id !== event.pointerId) return;
    if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4) drag.moved=true;
    if(!drag.moved)return;
    const scale = 140 / canvas.getBoundingClientRect().width;
    rotate((drag.x - event.clientX) * scale, (event.clientY - drag.y) * scale);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('pointerup', event=>{
    if(drag?.id!==event.pointerId || drag.moved)return;
    const sites=hit(pointAt(event));
    if(sites.length)emit('globepick',sites);
  });
  canvas.addEventListener('pointerleave',()=>emit('globehover',{point:null,sites:[]}));
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[event.key];
    if (delta) { event.preventDefault(); rotate(...delta); }
  });

  function recenter() {
    stopFlight();
    if (!marker) return;
    latitude = marker.lat;
    longitude = marker.lon;
    schedule();
  }

  function show(body, point, mark = true) {
    markCenter = mark;
    const texture = textures[body];
    world=body; current = texture;
    marker = point;
    recenter();
    canvas.setAttribute('aria-label', mark ? body + ' globe, marked location ' + point.lat + '°, ' + point.lon + '°' : body + ' globe, no surface site specified');
    status.textContent = texture.caption;
    if (texture.pixels) return;
    context.clearRect(0, 0, size, size);
    if (texture.loading) return;
    texture.loading = true;
    const image = new Image();
    image.onload = () => {
      const surface = document.createElement('canvas');
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const surfaceContext = surface.getContext('2d');
      surfaceContext.drawImage(image, 0, 0);
      texture.pixels = surfaceContext.getImageData(0, 0, surface.width, surface.height);
      if (current === texture) schedule();
    };
    image.onerror = () => {
      texture.loading = false;
      if (current === texture) status.textContent = 'Surface imagery unavailable';
    };
    image.src = texture.file;
  }
  function land(point, done) {
    const startLat = latitude, startLon = longitude;
    show('earth', point);
    // Traverse the shorter longitude arc, including across the date line.
    const delta = ((point.lon - startLon + 540) % 360) - 180;
    const start = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - start) / 1550);
      const eased = progress * progress * (3 - 2 * progress);
      latitude = startLat + (point.lat - startLat) * eased;
      longitude = startLon + delta * eased;
      schedule();
      if (progress < 1) flight = requestAnimationFrame(step);
      else done();
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else step(start);
  }
  return { show, recenter, land, stopFlight, setSites };
}
