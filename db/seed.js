require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

// Check if already seeded
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount > 0) {
  console.log('Database already seeded, skipping.');
  process.exit(0);
}

// ─── Default Users ────────────────────────────────────────────────────────────
const defaultPassword = bcrypt.hashSync('wk2026', 10);
const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
);
insertUser.run('joey',       defaultPassword, 1);
insertUser.run('annemieke',  defaultPassword, 0);
insertUser.run('mike',       defaultPassword, 0);
insertUser.run('shanna',     defaultPassword, 0);
insertUser.run('dave',       defaultPassword, 0);
console.log('Users created.');

// ─── Match Data ───────────────────────────────────────────────────────────────
// All times in CEST (UTC+2). Format: YYYY-MM-DDTHH:MM:00+02:00
const insertMatch = db.prepare(`
  INSERT INTO matches (match_number, stage, group_letter, home_team, away_team, kickoff_cest, venue)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const seedMatches = db.transaction(() => {
  // ── Group Stage ─────────────────────────────────────────────────────────────

  // Group A: Mexico, South Africa, Korea Republic, Czechia
  insertMatch.run(1,  'group','A','Mexico',         'South Africa',       '2026-06-11T21:00:00+02:00','Mexico City');
  insertMatch.run(2,  'group','A','Korea Republic', 'Czechia',            '2026-06-12T04:00:00+02:00','Zapopan');
  insertMatch.run(3,  'group','A','Czechia',        'South Africa',       '2026-06-18T18:00:00+02:00','Atlanta');
  insertMatch.run(4,  'group','A','Mexico',         'Korea Republic',     '2026-06-19T03:00:00+02:00','Zapopan');
  insertMatch.run(5,  'group','A','South Africa',   'Korea Republic',     '2026-06-25T03:00:00+02:00','Guadalajara');
  insertMatch.run(6,  'group','A','Czechia',        'Mexico',             '2026-06-25T03:00:00+02:00','Mexico City');

  // Group B: Canada, Bosnia & Herzegovina, Qatar, Switzerland
  insertMatch.run(7,  'group','B','Canada',              'Bosnia & Herzegovina','2026-06-12T21:00:00+02:00','Toronto');
  insertMatch.run(8,  'group','B','Qatar',               'Switzerland',         '2026-06-13T21:00:00+02:00','Santa Clara');
  insertMatch.run(9,  'group','B','Switzerland',         'Bosnia & Herzegovina','2026-06-18T21:00:00+02:00','Los Angeles');
  insertMatch.run(10, 'group','B','Canada',              'Qatar',               '2026-06-19T00:00:00+02:00','Vancouver');
  insertMatch.run(11, 'group','B','Switzerland',         'Canada',              '2026-06-24T21:00:00+02:00','Vancouver');
  insertMatch.run(12, 'group','B','Bosnia & Herzegovina','Qatar',               '2026-06-24T21:00:00+02:00','Seattle');

  // Group C: Brazil, Morocco, Haiti, Scotland
  insertMatch.run(13, 'group','C','Brazil',   'Morocco', '2026-06-14T00:00:00+02:00','East Rutherford');
  insertMatch.run(14, 'group','C','Haiti',    'Scotland','2026-06-14T03:00:00+02:00','Foxborough');
  insertMatch.run(15, 'group','C','Scotland', 'Morocco', '2026-06-20T00:00:00+02:00','Foxborough');
  insertMatch.run(16, 'group','C','Brazil',   'Haiti',   '2026-06-20T02:30:00+02:00','Philadelphia');
  insertMatch.run(17, 'group','C','Morocco',  'Haiti',   '2026-06-25T00:00:00+02:00','Atlanta');
  insertMatch.run(18, 'group','C','Scotland', 'Brazil',  '2026-06-25T00:00:00+02:00','Miami');

  // Group D: USA, Paraguay, Australia, Türkiye
  insertMatch.run(19, 'group','D','USA',       'Paraguay', '2026-06-13T03:00:00+02:00','Los Angeles');
  insertMatch.run(20, 'group','D','Australia', 'Türkiye',  '2026-06-14T06:00:00+02:00','Vancouver');
  insertMatch.run(21, 'group','D','USA',       'Australia','2026-06-19T21:00:00+02:00','Seattle');
  insertMatch.run(22, 'group','D','Türkiye',   'Paraguay', '2026-06-20T05:00:00+02:00','Santa Clara');
  insertMatch.run(23, 'group','D','Türkiye',   'USA',      '2026-06-26T04:00:00+02:00','Los Angeles');
  insertMatch.run(24, 'group','D','Paraguay',  'Australia','2026-06-26T04:00:00+02:00','Santa Clara');

  // Group E: Germany, Curaçao, Ivory Coast, Ecuador
  insertMatch.run(25, 'group','E','Germany',     'Curaçao',    '2026-06-14T19:00:00+02:00','Houston');
  insertMatch.run(26, 'group','E','Ivory Coast', 'Ecuador',    '2026-06-15T01:00:00+02:00','Philadelphia');
  insertMatch.run(27, 'group','E','Germany',     'Ivory Coast','2026-06-20T22:00:00+02:00','Toronto');
  insertMatch.run(28, 'group','E','Ecuador',     'Curaçao',    '2026-06-21T02:00:00+02:00','Kansas City');
  insertMatch.run(29, 'group','E','Curaçao',     'Ivory Coast','2026-06-25T22:00:00+02:00','Philadelphia');
  insertMatch.run(30, 'group','E','Ecuador',     'Germany',    '2026-06-25T22:00:00+02:00','East Rutherford');

  // Group F: Netherlands, Japan, Sweden, Tunisia
  insertMatch.run(31, 'group','F','Netherlands','Japan',  '2026-06-14T22:00:00+02:00','Arlington');
  insertMatch.run(32, 'group','F','Sweden',     'Tunisia','2026-06-15T04:00:00+02:00','Guadalajara');
  insertMatch.run(33, 'group','F','Netherlands','Sweden', '2026-06-20T19:00:00+02:00','Houston');
  insertMatch.run(34, 'group','F','Tunisia',    'Japan',  '2026-06-21T06:00:00+02:00','Guadalajara');
  insertMatch.run(35, 'group','F','Tunisia',    'Netherlands','2026-06-27T01:00:00+02:00','Kansas City');
  insertMatch.run(36, 'group','F','Japan',      'Sweden', '2026-06-27T01:00:00+02:00','Arlington');

  // Group G: Belgium, Egypt, Iran, New Zealand
  insertMatch.run(37, 'group','G','Belgium',     'Egypt',      '2026-06-15T21:00:00+02:00','Seattle');
  insertMatch.run(38, 'group','G','Iran',        'New Zealand','2026-06-16T03:00:00+02:00','Los Angeles');
  insertMatch.run(39, 'group','G','Belgium',     'Iran',       '2026-06-21T21:00:00+02:00','Los Angeles');
  insertMatch.run(40, 'group','G','New Zealand', 'Egypt',      '2026-06-22T03:00:00+02:00','Vancouver');
  insertMatch.run(41, 'group','G','New Zealand', 'Belgium',    '2026-06-28T05:00:00+02:00','Vancouver');
  insertMatch.run(42, 'group','G','Egypt',       'Iran',       '2026-06-28T05:00:00+02:00','Seattle');

  // Group H: Spain, Uruguay, Saudi Arabia, Cape Verde
  insertMatch.run(43, 'group','H','Spain',        'Cape Verde',  '2026-06-15T18:00:00+02:00','Atlanta');
  insertMatch.run(44, 'group','H','Saudi Arabia', 'Uruguay',     '2026-06-16T00:00:00+02:00','Miami');
  insertMatch.run(45, 'group','H','Spain',        'Saudi Arabia','2026-06-21T18:00:00+02:00','Atlanta');
  insertMatch.run(46, 'group','H','Uruguay',      'Cape Verde',  '2026-06-22T00:00:00+02:00','Miami');
  insertMatch.run(47, 'group','H','Cape Verde',   'Saudi Arabia','2026-06-28T02:00:00+02:00','Houston');
  insertMatch.run(48, 'group','H','Uruguay',      'Spain',       '2026-06-28T02:00:00+02:00','Zapopan');

  // Group I: France, Senegal, Norway, Iraq
  insertMatch.run(49, 'group','I','France',  'Senegal','2026-06-16T21:00:00+02:00','East Rutherford');
  insertMatch.run(50, 'group','I','Iraq',    'Norway', '2026-06-17T00:00:00+02:00','Foxborough');
  insertMatch.run(51, 'group','I','France',  'Iraq',   '2026-06-22T23:00:00+02:00','Philadelphia');
  insertMatch.run(52, 'group','I','Norway',  'Senegal','2026-06-23T02:00:00+02:00','Toronto');
  insertMatch.run(53, 'group','I','Norway',  'France', '2026-06-26T21:00:00+02:00','Foxborough');
  insertMatch.run(54, 'group','I','Senegal', 'Iraq',   '2026-06-26T21:00:00+02:00','Toronto');

  // Group J: Argentina, Algeria, Austria, Jordan
  insertMatch.run(55, 'group','J','Argentina','Algeria','2026-06-17T03:00:00+02:00','Kansas City');
  insertMatch.run(56, 'group','J','Austria',  'Jordan', '2026-06-17T06:00:00+02:00','Santa Clara');
  insertMatch.run(57, 'group','J','Argentina','Austria','2026-06-22T19:00:00+02:00','Arlington');
  insertMatch.run(58, 'group','J','Jordan',   'Algeria','2026-06-23T05:00:00+02:00','Santa Clara');
  insertMatch.run(59, 'group','J','Algeria',  'Austria','2026-06-28T04:00:00+02:00','Kansas City');
  insertMatch.run(60, 'group','J','Jordan',   'Argentina','2026-06-28T04:00:00+02:00','Arlington');

  // Group K: Portugal, DR Congo, Colombia, Uzbekistan
  insertMatch.run(61, 'group','K','Portugal',   'DR Congo',  '2026-06-17T19:00:00+02:00','Houston');
  insertMatch.run(62, 'group','K','Uzbekistan', 'Colombia',  '2026-06-18T04:00:00+02:00','Mexico City');
  insertMatch.run(63, 'group','K','Portugal',   'Uzbekistan','2026-06-23T19:00:00+02:00','Houston');
  insertMatch.run(64, 'group','K','Colombia',   'DR Congo',  '2026-06-24T04:00:00+02:00','Zapopan');
  insertMatch.run(65, 'group','K','Colombia',   'Portugal',  '2026-06-29T01:30:00+02:00','Miami');
  insertMatch.run(66, 'group','K','DR Congo',   'Uzbekistan','2026-06-29T01:30:00+02:00','Atlanta');

  // Group L: England, Croatia, Panama, Ghana
  insertMatch.run(67, 'group','L','England','Croatia','2026-06-17T22:00:00+02:00','Arlington');
  insertMatch.run(68, 'group','L','Ghana',  'Panama', '2026-06-18T01:00:00+02:00','Toronto');
  insertMatch.run(69, 'group','L','England','Ghana',  '2026-06-23T22:00:00+02:00','Foxborough');
  insertMatch.run(70, 'group','L','Panama', 'Croatia','2026-06-25T01:00:00+02:00','Foxborough');
  insertMatch.run(71, 'group','L','Panama', 'England','2026-07-01T23:00:00+02:00','East Rutherford');
  insertMatch.run(72, 'group','L','Croatia','Ghana',  '2026-07-01T23:00:00+02:00','Philadelphia');

  // ── Round of 32 ─────────────────────────────────────────────────────────────
  insertMatch.run(73, 'r32',null,'2e Groep A',          '2e Groep B',              '2026-06-28T21:00:00+02:00','Los Angeles');
  insertMatch.run(74, 'r32',null,'1e Groep C',          '2e Groep F',              '2026-06-29T19:00:00+02:00','Houston');
  insertMatch.run(75, 'r32',null,'1e Groep E',          'Beste 3e (A/B/C/D/F)',   '2026-06-29T22:30:00+02:00','Foxborough');
  insertMatch.run(76, 'r32',null,'1e Groep F',          '2e Groep C',              '2026-06-30T03:00:00+02:00','Guadalajara');
  insertMatch.run(77, 'r32',null,'2e Groep E',          '2e Groep I',              '2026-06-30T19:00:00+02:00','Arlington');
  insertMatch.run(78, 'r32',null,'1e Groep I',          'Beste 3e (C/D/F/G/H)',   '2026-06-30T23:00:00+02:00','East Rutherford');
  insertMatch.run(79, 'r32',null,'1e Groep A',          'Beste 3e (C/E/F/H/I)',   '2026-07-01T03:00:00+02:00','Mexico City');
  insertMatch.run(80, 'r32',null,'1e Groep L',          'Beste 3e (E/H/I/J/K)',   '2026-07-01T18:00:00+02:00','Atlanta');
  insertMatch.run(81, 'r32',null,'1e Groep G',          'Beste 3e (A/E/H/I/J)',   '2026-07-01T22:00:00+02:00','Seattle');
  insertMatch.run(82, 'r32',null,'1e Groep D',          'Beste 3e (B/E/F/I/J)',   '2026-07-02T02:00:00+02:00','Santa Clara');
  insertMatch.run(83, 'r32',null,'1e Groep H',          '2e Groep J',              '2026-07-02T21:00:00+02:00','Los Angeles');
  insertMatch.run(84, 'r32',null,'2e Groep K',          '2e Groep L',              '2026-07-03T01:00:00+02:00','Toronto');
  insertMatch.run(85, 'r32',null,'1e Groep B',          'Beste 3e (E/F/G/I/J)',   '2026-07-03T05:00:00+02:00','Vancouver');
  insertMatch.run(86, 'r32',null,'2e Groep D',          '2e Groep G',              '2026-07-03T20:00:00+02:00','Arlington');
  insertMatch.run(87, 'r32',null,'1e Groep J',          '2e Groep H',              '2026-07-04T00:00:00+02:00','Miami');
  insertMatch.run(88, 'r32',null,'1e Groep K',          'Beste 3e (D/E/I/J/L)',   '2026-07-04T03:30:00+02:00','Kansas City');

  // ── Round of 16 ─────────────────────────────────────────────────────────────
  insertMatch.run(89, 'r16',null,'Winnaar W73','Winnaar W75','2026-07-04T19:00:00+02:00','Houston');
  insertMatch.run(90, 'r16',null,'Winnaar W74','Winnaar W77','2026-07-04T23:00:00+02:00','Philadelphia');
  insertMatch.run(91, 'r16',null,'Winnaar W76','Winnaar W78','2026-07-05T22:00:00+02:00','East Rutherford');
  insertMatch.run(92, 'r16',null,'Winnaar W79','Winnaar W80','2026-07-06T02:00:00+02:00','Mexico City');
  insertMatch.run(93, 'r16',null,'Winnaar W83','Winnaar W84','2026-07-06T21:00:00+02:00','Arlington');
  insertMatch.run(94, 'r16',null,'Winnaar W81','Winnaar W82','2026-07-07T02:00:00+02:00','Seattle');
  insertMatch.run(95, 'r16',null,'Winnaar W86','Winnaar W88','2026-07-07T18:00:00+02:00','Atlanta');
  insertMatch.run(96, 'r16',null,'Winnaar W85','Winnaar W87','2026-07-07T22:00:00+02:00','Vancouver');

  // ── Quarter Finals ──────────────────────────────────────────────────────────
  insertMatch.run(97,  'qf',null,'Winnaar W89','Winnaar W90','2026-07-09T22:00:00+02:00','Foxborough');
  insertMatch.run(98,  'qf',null,'Winnaar W93','Winnaar W94','2026-07-10T21:00:00+02:00','Los Angeles');
  insertMatch.run(99,  'qf',null,'Winnaar W91','Winnaar W92','2026-07-11T23:00:00+02:00','Miami');
  insertMatch.run(100, 'qf',null,'Winnaar W95','Winnaar W96','2026-07-12T03:00:00+02:00','Kansas City');

  // ── Semi Finals ─────────────────────────────────────────────────────────────
  insertMatch.run(101, 'sf',null,'Winnaar W97','Winnaar W98', '2026-07-14T21:00:00+02:00','Arlington');
  insertMatch.run(102, 'sf',null,'Winnaar W99','Winnaar W100','2026-07-15T21:00:00+02:00','Atlanta');

  // ── Third Place ─────────────────────────────────────────────────────────────
  insertMatch.run(103, '3rd',null,'Verliezer W101','Verliezer W102','2026-07-18T23:00:00+02:00','Miami');

  // ── Final ────────────────────────────────────────────────────────────────────
  insertMatch.run(104, 'final',null,'Winnaar W101','Winnaar W102','2026-07-19T21:00:00+02:00','East Rutherford');
});

seedMatches();
console.log('Matches seeded (104 total).');
console.log('\nDefault credentials for all users: wk2026');
console.log('Admin account: joey');
