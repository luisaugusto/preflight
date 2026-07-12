import type { ImageSource } from 'expo-image';

// Generated/maintained alongside extracted handbook figures. Remote Sanity CDN
// URLs are accepted directly; bundled files are registered here for offline use.
export const FIGURE_ASSETS: Record<string, ImageSource> = {
  'chapter-01-early-flight.jpg': require('../../assets/phak/chapter-01-early-flight.jpg'),
  'chapter-02-pave-checklist.jpg': require('../../assets/phak/chapter-02-pave-checklist.jpg'),
  'chapter-03-airplane-components.jpg': require('../../assets/phak/chapter-03-airplane-components.jpg'),
  'chapter-04-airfoil-principles.jpg': require('../../assets/phak/chapter-04-airfoil-principles.jpg'),
  'chapter-05-angle-of-attack.jpg': require('../../assets/phak/chapter-05-angle-of-attack.jpg'),
  'chapter-06-primary-controls.jpg': require('../../assets/phak/chapter-06-primary-controls.jpg'),
  'chapter-07-engine-arrangements.jpg': require('../../assets/phak/chapter-07-engine-arrangements.jpg'),
  'chapter-08-pitot-static.jpg': require('../../assets/phak/chapter-08-pitot-static.jpg'),
  'chapter-09-aircraft-documents.jpg': require('../../assets/phak/chapter-09-aircraft-documents.jpg'),
  'chapter-10-loading-envelope.jpg': require('../../assets/phak/chapter-10-loading-envelope.jpg'),
  'chapter-11-density-altitude.jpg': require('../../assets/phak/chapter-11-density-altitude.jpg'),
  'chapter-12-thunderstorm-cycle.jpg': require('../../assets/phak/chapter-12-thunderstorm-cycle.jpg'),
  'chapter-13-weather-codes.jpg': require('../../assets/phak/chapter-13-weather-codes.jpg'),
  'chapter-14-airport-signs.jpg': require('../../assets/phak/chapter-14-airport-signs.jpg'),
  'chapter-15-airspace-profile.jpg': require('../../assets/phak/chapter-15-airspace-profile.jpg'),
  'chapter-16-sectional-chart.jpg': require('../../assets/phak/chapter-16-sectional-chart.jpg'),
  'chapter-17-spatial-disorientation.jpg': require('../../assets/phak/chapter-17-spatial-disorientation.jpg'),
};

for (const [name, source] of Object.entries({ ...FIGURE_ASSETS })) {
  FIGURE_ASSETS[`assets/phak/${name}`] = source;
  FIGURE_ASSETS[`./assets/phak/${name}`] = source;
}
