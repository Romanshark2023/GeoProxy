import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'.runtime'))
import numpy as np,h5py
from PIL import Image
root=Path(__file__).resolve().parents[1]
f=h5py.File(root/'geoproxy-data/raw/earth/earth_relief_05m.grd')
print(list(f.keys()),flush=True)
z=np.array(f['z']).astype(float);z[z==-32768]=np.nan;z*=float(f['z'].attrs['scale_factor'][0]); lat=np.array(f['lat']);lon=np.array(f['lon'])
mars=np.fromfile(root/'geoproxy-data/raw/mars/megt90n000eb.img',dtype='>i2').reshape(2880,5760)
def patch(a,b,body):
 radius=3389500 if body=='mars' else 6371000
 dy=10000/radius*180/math.pi;dx=dy/math.cos(math.radians(a))
 ys=a+np.arange(-3,4)*dy;xs=b+np.arange(-3,4)*dx
 if body=='mars':
  iy=np.clip(((90-ys)/.0625).astype(int),0,2879);ix=((xs%360)/.0625).astype(int)%5760;v=mars[np.ix_(iy,ix)].astype(float)
 else:
  iy=np.abs(lat[:,None]-ys).argmin(axis=0);ix=np.abs(lon[:,None]-xs).argmin(axis=0);v=z[np.ix_(iy,ix)].astype(float)
 if not np.isfinite(v).all() or (body=='earth' and (v<=0).any()): return None
 gy,gx=np.gradient(v,10000)
 return {'relief':float(np.percentile(v,90)-np.percentile(v,10)),'slope':float(np.median(np.degrees(np.arctan(np.hypot(gx,gy))))),'grid':v.round().astype(int).tolist()}
earth=[]
for a in range(-60,81,2):
 for b in range(-178,180,2):
  p=patch(a,b,'earth')
  if p:earth.append({'lat':a,'lon':b,**p})
features=np.array([[np.log1p(e['relief']),np.log1p(e['slope'])] for e in earth]);scale=features.std(axis=0)
targets=[]
for name,a,b in [('Jezero Crater',18.38,77.58),('Gale Crater',-5.4,137.8),('Elysium Planitia',4.5,135.6)]:
 p=patch(a,b,'mars'); q=np.log1p([p['relief'],p['slope']]);dist=np.sqrt(np.mean(((features-q)/scale)**2,axis=1));order=np.argsort(dist);chosen=[]
 for i in order:
  e=earth[i]
  if all(math.hypot(e['lat']-c['lat'],e['lon']-c['lon'])>4 for c in chosen):chosen.append({**e,'score':round(100*math.exp(-float(dist[i])),1)})
  if len(chosen)==5:break
 targets.append({'name':name,'lat':a,'lon':b,**p,'matches':chosen})
(root/'data/demo.json').write_text(json.dumps({'candidates':len(earth),'targets':targets,'method':'Equal weights on log(1+relief) and log(1+median slope), standardized by sampled Earth variability. Score = 100 exp(-RMS standardized distance). 7×7 sample points at 10 km spacing; centers every 2°. Excludes windows with elevation ≤0 m; this is a coarse land filter, not a coastline mask.'}))
# Real MOLA elevation rendered as a globe texture, not photographic imagery.
a=mars[::3,::3].astype(float);t=np.clip((a+8000)/20000,0,1);rgb=np.stack([70+170*t,34+130*t,24+95*t],axis=-1).astype('uint8');Image.fromarray(rgb).save(root/'data/mars-relief.jpg')
print('Candidates',len(earth),'matches',[(t['name'],t['matches'][0]['score']) for t in targets],flush=True)

