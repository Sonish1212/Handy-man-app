// Photos bundled with the app, keyed by service slug (Supabase) and by the
// local placeholder ids in ./home. Anything with no entry here keeps its
// sage icon card until a photo is added.
//
// Spare photos not used by any launch service yet:
//   assets/photos/carpenter.jpg, assets/photos/car-mechanic.jpg

const plumber = require('../../assets/photos/plumber.jpg');
const electrician = require('../../assets/photos/electrician.jpg');
const labour = require('../../assets/photos/labour.jpg');
const acRefrigerator = require('../../assets/photos/ac-refrigerator.jpg');
const painter = require('../../assets/photos/painter.jpg');
const tileMarble = require('../../assets/photos/tile-marble.jpg');
const waterPurifier = require('../../assets/photos/water-purifier.jpg');
const festivalPainting = require('../../assets/photos/festival-painting.jpg');
const monsoonLeak = require('../../assets/photos/monsoon-leak.jpg');
const homeCleaning = require('../../assets/photos/home-cleaning.jpg');
const generalCleaning = require('../../assets/photos/general-cleaning.jpg');

export const servicePhotos = {
  'home-cleaning': homeCleaning,
  'general-cleaning': generalCleaning,
  plumber,
  'tap-repair': plumber,
  electrician,
  'fan-install': electrician,
  fan: electrician,
  'labour-mistri': labour,
  labour,
  'ac-appliance': acRefrigerator,
  ac: acRefrigerator,
  'ac-service': acRefrigerator,
  painter,
  'room-paint': painter,
  'tile-marble': tileMarble,
  tile: tileMarble,
  'water-purifier': waterPurifier,
  purifier: waterPurifier,
};

// "This season" cards, keyed by their ids in ./home.
export const seasonPhotos = {
  'festival-cleaning': homeCleaning,
  'festival-paint': festivalPainting,
  leak: monsoonLeak,
};
