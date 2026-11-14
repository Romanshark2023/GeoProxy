const fs = require('fs');
const path = require('path');
const source = path.join(__dirname, '../geoproxy-data/raw/mars/megt90n000eb.img');
const destination = path.join(__dirname, '../data/jezero-mola-sample.json');
const bytes = fs.readFileSync(source);
const width = 5760, height = 2880, step = 0.0625;
if (bytes.length !== width * height * 2) throw new Error('Unexpected MOLA raster size');
const center = { latitude: 18.38, longitude: 77.58 };
const size = 31;
const cells = [];
for (let row = 0; row < size; row++) {
  const line = [];
  for (let col = 0; col < size; col++) {
    const lat = center.latitude + (size / 2 - row - .5) * step;
    const lon = center.longitude + (col - size / 2 + .5) * step;
    const y = Math.floor((90 - lat) / step);
    const x = Math.floor(lon / step);
    line.push(bytes.readInt16BE((y * width + x) * 2));
  }
  cells.push(line);
}
const flat = cells.flat();
const result = {
  target: 'Jezero Crater, Mars', center, grid: { rows: size, columns: size, degreesPerCell: step },
  elevationMeters: cells,
  summary: { minMeters: Math.min(...flat), maxMeters: Math.max(...flat), centerMeters: cells[15][15] },
  provenance: { product: 'MGS MOLA MEGDR megt90n000eb', version: '1.1', units: 'meters relative to Mars areoid', resolution: '0.0625 degrees', source: 'https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.img', caveat: 'MOLA fills cells without observations by interpolation; this sample cannot distinguish those cells.' }
};
fs.writeFileSync(destination, JSON.stringify(result));
console.log(`Wrote ${destination}: ${flat.length} cells, ${result.summary.minMeters} to ${result.summary.maxMeters} m`);
