// Shared flag helper. Uses locally-bundled SVGs under /flags so country flags
// render identically on every platform (Windows desktop has no flag emoji glyphs,
// which is why the old emoji approach showed letter codes there).

const FLAG_ISO = {
  'Mexico': 'mx', 'South Africa': 'za', 'Korea Republic': 'kr', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia & Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'USA': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Türkiye': 'tr',
  'Germany': 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Uruguay': 'uy', 'Saudi Arabia': 'sa', 'Cape Verde': 'cv',
  'France': 'fr', 'Senegal': 'sn', 'Norway': 'no', 'Iraq': 'iq',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Colombia': 'co', 'Uzbekistan': 'uz',
  'England': 'gb-eng', 'Croatia': 'hr', 'Panama': 'pa', 'Ghana': 'gh',
};

function flagUrl(name) {
  const code = FLAG_ISO[name];
  return code ? `/flags/${code}.svg` : null;
}

// Returns an <img> tag for a known country, or a neutral placeholder box for
// unresolved knockout slots ("Winnaar Groep E" etc.). extraClass is optional.
function flagImg(name, extraClass) {
  const url = flagUrl(name);
  const cls = `team-flag ${extraClass || ''}`.trim();
  if (url) return `<img class="${cls}" src="${url}" alt="" loading="lazy">`;
  return `<span class="${cls} team-flag-tbd" aria-hidden="true"></span>`;
}
