/**
 * Major annual meteor showers. Peak solar longitude, ZHR and radiant come from the
 * International Meteor Organization working list. ZHR is the idealised rate under a perfectly
 * dark sky with the radiant overhead; real counts are lower and the scripts must say "around"/"up to".
 */
export interface MeteorShower {
  code: string;
  name: string;
  /** Solar longitude (J2000, degrees) at peak. */
  peakSolarLongitude: number;
  zhr: number;
  /** Radiant at peak, J2000. RA in degrees. */
  radiant: { ra: number; dec: number };
  /** Constellation id (d3-celestial abbreviation) that holds the radiant. */
  constellation: string;
  parentBody: string;
}

export const METEOR_SHOWER_SOURCE = {
  url: 'https://www.imo.net/resources/calendar/',
  title: 'IMO Meteor Shower Calendar / working list of visual meteor showers',
  publisher: 'International Meteor Organization',
} as const;

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  {
    code: 'QUA',
    name: 'Quadrantids',
    peakSolarLongitude: 283.15,
    zhr: 80,
    radiant: { ra: 230, dec: 49 },
    constellation: 'Boo',
    parentBody: 'asteroid 2003 EH1',
  },
  {
    code: 'LYR',
    name: 'Lyrids',
    peakSolarLongitude: 32.32,
    zhr: 18,
    radiant: { ra: 271, dec: 34 },
    constellation: 'Lyr',
    parentBody: 'comet C/1861 G1 Thatcher',
  },
  {
    code: 'ETA',
    name: 'Eta Aquariids',
    peakSolarLongitude: 45.5,
    zhr: 50,
    radiant: { ra: 338, dec: -1 },
    constellation: 'Aqr',
    parentBody: 'comet 1P/Halley',
  },
  {
    code: 'SDA',
    name: 'Southern Delta Aquariids',
    peakSolarLongitude: 127,
    zhr: 25,
    radiant: { ra: 340, dec: -16 },
    constellation: 'Aqr',
    parentBody: 'comet 96P/Machholz',
  },
  {
    code: 'PER',
    name: 'Perseids',
    peakSolarLongitude: 140.0,
    zhr: 100,
    radiant: { ra: 48, dec: 58 },
    constellation: 'Per',
    parentBody: 'comet 109P/Swift–Tuttle',
  },
  {
    code: 'DRA',
    name: 'Draconids',
    peakSolarLongitude: 195.4,
    zhr: 10,
    radiant: { ra: 262, dec: 54 },
    constellation: 'Dra',
    parentBody: 'comet 21P/Giacobini–Zinner',
  },
  {
    code: 'ORI',
    name: 'Orionids',
    peakSolarLongitude: 208,
    zhr: 20,
    radiant: { ra: 95, dec: 16 },
    constellation: 'Ori',
    parentBody: 'comet 1P/Halley',
  },
  {
    code: 'LEO',
    name: 'Leonids',
    peakSolarLongitude: 235.27,
    zhr: 15,
    radiant: { ra: 152, dec: 22 },
    constellation: 'Leo',
    parentBody: 'comet 55P/Tempel–Tuttle',
  },
  {
    code: 'GEM',
    name: 'Geminids',
    peakSolarLongitude: 262.2,
    zhr: 150,
    radiant: { ra: 112, dec: 33 },
    constellation: 'Gem',
    parentBody: 'asteroid 3200 Phaethon',
  },
  {
    code: 'URS',
    name: 'Ursids',
    peakSolarLongitude: 270.7,
    zhr: 10,
    radiant: { ra: 217, dec: 76 },
    constellation: 'UMi',
    parentBody: 'comet 8P/Tuttle',
  },
];
