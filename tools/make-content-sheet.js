// Generates the client-facing Word content sheet for the homepage mockup.
// Usage: NODE_PATH=<dir containing node_modules/docx> node tools/make-content-sheet.js "<output.docx>"
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  HeadingLevel, AlignmentType, BorderStyle, LevelFormat
} = require('docx');

const OUT = process.argv[2];
const TRIPS = require('./trips-data.js').filter(t => t.slug);
const NAVY = '0B1C2B', GLACIER = '1F5D8C', FROST = 'E9F3FA', LINE = 'DCE7EF', GRAY = '54697A', SUN = 'E8A33D';
const FONT = 'Calibri';
const TW = 9360; // 6.5in text width in DXA
const COLS3 = [1900, 4560, 2900];

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

function run(text, opts = {}) { return new TextRun({ text, font: FONT, size: 20, ...opts }); }
function p(text, opts = {}) { return new Paragraph({ children: [run(text, opts.run || {})], spacing: { after: 100 }, ...opts.para }); }
function small(text, opts = {}) { return new Paragraph({ children: [run(text, { size: 18, color: GRAY, italics: true, ...opts })], spacing: { after: 120 } }); }
function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 }, children: [new TextRun({ text, font: FONT, size: 30, bold: true, color: NAVY })] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: GLACIER })] }); }
function bullets(items) { return items.map(t => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60 }, children: [run(t)] })); }

function cell(children, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: Array.isArray(children) ? children : [children]
  });
}
function textCell(text, width, opts = {}) {
  const lines = Array.isArray(text) ? text : [text];
  return cell(lines.map((t, i) => new Paragraph({ spacing: { after: i === lines.length - 1 ? 0 : 60 }, children: [run(t, opts.run || {})] })), width, opts);
}
function headerRow(labels, widths) {
  return new TableRow({ tableHeader: true, children: labels.map((l, i) => textCell(l, widths[i], { fill: NAVY, run: { bold: true, color: 'FFFFFF', size: 18 } })) });
}
function table3(rows, widths = COLS3, labels = ['Element', 'Current content on the mockup', 'Your notes / changes']) {
  return new Table({
    width: { size: TW, type: WidthType.DXA }, columnWidths: widths,
    rows: [headerRow(labels, widths), ...rows.map(r => new TableRow({ children: [
      textCell(r[0], widths[0], { fill: FROST, run: { bold: true, size: 19 } }),
      textCell(r[1], widths[1]),
      textCell(r[2] || '', widths[2], { run: { color: GRAY } })
    ] }))]
  });
}
function placeholder(text) { return new Paragraph({ spacing: { before: 100, after: 140 }, children: [run('PLACEHOLDER — ', { bold: true, color: 'B7791F', size: 19 }), run(text, { size: 19 })] }); }
function gap() { return new Paragraph({ spacing: { after: 60 }, children: [] }); }

const children = [];

// Title block
children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'SHASTA MOUNTAIN GUIDES', font: FONT, size: 40, bold: true, color: NAVY })] }));
children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Website Content Sheet — Round 3', font: FONT, size: 28, color: GLACIER })] }));
children.push(new Paragraph({ spacing: { after: 60 }, children: [run('Homepage + program pages · prepared by The Clay Media · revised October 21, 2026 with Chris’s Round 3 notes and October 13 photos applied', { color: GRAY })] }));
children.push(new Paragraph({ spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: SUN, space: 6 } }, children: [run('Round 3 applies every note Chris left on the Round 2 sheet, adds the gear lists, training plans and photos from the shared Drive folder, and introduces the eight program pages (Part 2).', { color: GRAY })] }));

children.push(h2('How to use this document'));
children.push(p('Everything below is the copy currently on the updated mockup. Nothing here is final.'));
children.push(p('Use the right-hand column for changes, or highlight any line and leave a comment. Either works.'));
children.push(p('If a section is good as-is, you can leave it blank. Silence means approved.'));
children.push(p('Anything marked PLACEHOLDER needs a decision or content from you before we build.'));
children.push(new Paragraph({ spacing: { before: 80, after: 200 }, children: [run('What changed since round 2: ', { bold: true }), run('45 years and the 2027 season throughout; trip cards reordered as requested; the guide roster rebuilt around the eleven guides you listed, with headshots pulled from your current site; the youth teams named; the new call-to-action headline; and the real gear lists and training plans now behind the Free Resources downloads. Rows marked “Done” in the notes column are your Round 2 requests as applied. New in this round: Part 2 covers the eight program pages, one per trip card, so you can mark which trips to keep, cut or reprice.')] }));
children.push(new Paragraph({ spacing: { before: 0, after: 240 }, children: [run('Part 1 · Homepage', { bold: true, size: 24, color: NAVY })] }));

// 1 Page settings
children.push(h1('1.  Page settings & search listing'));
children.push(small('This is what people see on Google before they ever reach the site.'));
children.push(table3([
  ['Page title', 'Shasta Mountain Guides | The Original Guide Service on Mt. Shasta'],
  ['Meta description', 'Shasta Mountain Guides - The original guides on Mt. Shasta. Climb, Ski, Hike and Explore Mount Shasta with local professionals with over 45 years of experience on the mountain.', 'Done — updated to 45 years.'],
]));

// 2 Nav
children.push(h1('2.  Navigation'));
children.push(table3([
  ['Main menu', 'Trips & Courses  ·  Our Guides  ·  Learn  ·  Free Resources  ·  Contact', 'Menu items scroll to sections on the homepage.'],
  ['Header button', 'Book Now', 'Will open The Flybook reservation window inside the page once we have login access to pull the booking links.'],
]));
children.push(placeholder('We need a Flybook login (or the booking links) to wire up Book Now. Also confirm whether Trip Details / Routes & Seasons should return to the menu as a dropdown.'));

// 3 Hero
children.push(h1('3.  Hero (top of page)'));
children.push(small('A slow, back-to-back slideshow of your three hero photos with a gentle pan on each. No changes requested in Round 2.'));
children.push(table3([
  ['Eyebrow', 'Mt Shasta, California · 14,179 ft'],
  ['Headline', 'The Original Guide Service on Mt. Shasta'],
  ['Sub-line', '(Waka-nunee-Tuki-wuki)'],
  ['Primary button', 'Plan My Climb  (scrolls to the contact form)'],
  ['Secondary button', 'Find Your Trip  (scrolls to Trips & Courses)'],
  ['Slide 1', '“CATO high5” — two climbers high-five on the summit with prayer flags'],
  ['Slide 2', '“CATO flags” — group holding prayer flags in a circle on the snow'],
  ['Slide 3', '“AGskintrack” — Avalanche Gulch and the Red Banks under blue sky'],
]));

// 4 Trips
children.push(h1('4.  Trips & Courses'));
children.push(table3([
  ['Eyebrow', 'Trips & Courses'],
  ['Heading', 'Find your trip'],
  ['Intro line', 'Guided climbs, mountaineering courses, & backcountry skiing trips on Mt Shasta.'],
]));
children.push(gap());
children.push(small('The eight trip cards in their new order. Every image is one of your originals.'));
children.push(table3([
  ['1. Climb Shasta', 'Photo: “shasta climb gulch shadow” — rope team at sunrise with the mountain’s shadow behind'],
  ['2. Ski Shasta', 'Photo: “Shastaski.gulch” — skier carving powder below the Red Banks'],
  ['3. Mountaineering Courses', 'Photo: “guide helping” — guide fitting a climber’s crampons at camp', 'Done — moved to third.'],
  ['4. Custom Trips', 'Photo: “Climb.north2” — climbers on the north side at sunrise', 'Done — moved to fourth.'],
  ['5. Avalanche Courses', 'Photo: “skintrack” — skin track winding up a snowy ridge', 'Done — moved to fifth.'],
  ['6. Backpacking', 'Photo: “Northside basecamp” — filling a bottle from a spring at basecamp', 'Done — moved to sixth.'],
  ['7. Rock Climbing', 'Photo: “mz.cosmic” — a climber on the granite of Cosmic Wall in Castle Crags', 'Done — moved to seventh, and now uses your Cosmic Wall photo. Is this Michael Zanger? We can caption it.'],
  ['8. Day Trips', 'Photo: “Shasta trailhead” — group raising poles at the trailhead'],
], COLS3, ['Card', 'Image now used', 'Your notes / swap']));
children.push(placeholder('Each card still needs a destination page and one short line of description. Tell us which programs are being retired and we will draft the lines for the ones that remain.'));

// 5 Why
children.push(h1('5.  Why Shasta Mountain Guides'));
children.push(table3([
  ['Eyebrow', 'Why Shasta Mountain Guides'],
  ['Heading', 'This is our home.'],
  ['Body copy', 'Shasta Mountain Guides is the original climbing guide service on Mt. Shasta and leads the highest quality expeditions and courses on the mountain. For over 45 years we have shared this remarkable experience offering an unmatched level of service on Mount Shasta. This is our home and we have the ultimate respect for the mountain, the community, and our family of guides and staff who work diligently to help you achieve your goals. We are local professionals committed to your safety and enjoyment. This climb is ideal for new and experienced mountaineers and with the proper training and preparation, the summit is a very attainable goal. Be ready for the trip of a lifetime!', 'Done — 45 years.'],
  ['Season line', 'We are taking reservations for the 2027 climbing season, our 45th year leading climbs on Mt. Shasta.', 'Done — 2027 season, 45th year.'],
  ['Button', 'Plan My Climb  (scrolls to the contact form)'],
  ['Photo', '“shasta team” — team gathered by headlamp before an alpine start'],
  ['Highlight 1', 'The Original — Guide service on Mt. Shasta'],
  ['Highlight 2', 'Over 45 Years — On the mountain', 'Done.'],
  ['Highlight 3', 'Local Professionals — Committed to your safety and enjoyment'],
]));

// 6 Guides
children.push(h1('6.  Meet Your Guides'));
children.push(table3([
  ['Eyebrow', 'Meet Your Guides'],
  ['Heading', 'The people who will get you to the top.'],
  ['Intro paragraph 1', 'SMG was founded in the late 1970s by Michael Zanger. In 2003 longtime guides Chris and Jenn Carr took over and have grown the team to a seasonal staff of over 30. Our common bond is a pure passion for being in the mountains and sharing that with you. Between us we have thousands of Shasta summits and we have explored every route in every season.'],
  ['Intro paragraph 2', 'You will know your guide before you clip in. Every trip is led by a certified professional who lives and works on this mountain, not a contractor flown in for the weekend.'],
  ['Section photo', '“BCPP_2026_CATO” — the team celebrating together on the summit'],
  ['Button', 'Meet the whole team  (links to your About page)'],
]));
children.push(gap());
children.push(small('The fourteen profiles now on the homepage: you two, plus the eleven guides you asked us to feature. Headshots were pulled from your current About page; blurbs are condensed from the bios there. Jenna Kane, Nick Caselli and Casey Glaubman have been moved off the homepage and remain on the full team page.'));
children.push(table3([
  ['Chris Carr', ['Co-Owner · AIARE III, AMGA Alpine & Ski', 'Living and climbing in Mt. Shasta since 1995 with over 180 summits and countless ski descents. Chris runs operations and you will still find him on the mountain checking conditions.', 'Badge: Lives in Mt. Shasta · Headshot: yes']],
  ['Jenn Carr', ['Co-Owner · EMT, WFR, AIARE III', 'A California native who started guiding on Shasta in 1998 with over 50 summits. Jenn runs the daily operations and is often the first voice you hear when you reach out.', 'Badge: Lives in Mt. Shasta · Headshot: yes']],
  ['Rich Meyer', ['Senior Guide · AMGA Certified Ski Guide, AIARE Lead Instructor', 'Twenty-five years guiding peaks from the Alps to Antarctica and close to 150 Shasta summits. Rich runs our guide training, special events and avalanche seminars.', 'Headshot: yes']],
  ['Dane Brinkley', ['Senior Guide · AIARE III Instructor, WFR', 'Over 200 Shasta summits, often on skis, plus three Denali expeditions. Dane guides year round on every major route and wrote our training plan.', 'Headshot: yes']],
  ['David Reichel', ['Senior Guide · AIARE III, AAA Pro Trainer', 'A California Cascades native and avalanche educator who founded the California Avalanche Workshop. Happiest leading ski and splitboard trips in powder.', 'Headshot: yes']],
  ['Katie Wry', ['Senior Guide · AIARE II, EMT, AMGA Alpine Skills', 'Ten years of ski patrol at Kirkwood before guiding. Katie is as passionate about teaching people as she is about the mountains themselves.', 'Headshot: yes']],
  ['Tailer Spinney', ['Lead Guide · AIARE II, WFR, AMGA SPI', 'Leads our mountaineering trips, glacier seminars and backpacking program. Tailer’s always-positive attitude makes any trip with her a fun one.', 'Headshot: yes']],
  ['Greg Cunningham', ['Senior Guide · AAI III, OEC, AMGA Ski & Alpine', 'Lead avalanche forecaster at Kirkwood in winter and a fixture on Shasta every spring and summer. Calm, decisive and always learning.', 'Headshot: yes']],
  ['John Michael McGinn', ['Senior Guide · AMGA Certified Ski Guide, AAA Pro 2', 'Honed in the Tetons’ steep couloirs and alpine routes, with seasons in the Alps and Canadian Rockies. Working toward full international certification.', 'Headshot: NONE on current site — shows initials'], 'Chris: photo not found. Initials stay until one arrives.'],
  ['Ethan Atkins', ['Guide · AIARE I, WFR', 'Rock and alpine climber across the western U.S. and Canada who also leads outdoor education trips for underserved youth in Big Sur.', 'Headshot: yes']],
  ['Travis Soares', ['Guide · Adventure Education, Prescott College', 'Thru-hiked the Appalachian Trail and climbed all 247 Sierra Peaks Section summits in 117 days. Loves the mountains at whatever pace gets you there.', 'Headshot: yes']],
  ['Daniel Ross', ['Lead Guide · AMGA Assistant Rock Guide, AAI Pro 1', 'Guiding on Shasta since 2023 with teaching at the heart of everything he does. Ask him “why?” about anything in the mountains and he’ll light up.', 'Headshot: yes']],
  ['Lael Cashen', ['Lead Guide · WFR, OEC, CAA Operations', 'Studied guiding at Thompson Rivers University and splits her seasons between Northern California and British Columbia ski patrol and touring lodges.', 'Headshot: NONE on current site — shows initials'], 'Chris: photo not found. Initials stay until one arrives.'],
  ['Rachel Foucher', ['Guide', 'Photo and bio coming soon.', 'Headshot: NONE — not on current site'], 'Chris: photo not found, needs more information. Confirm whether to keep her on the homepage.'],
], COLS3, ['Guide', 'Role, blurb and badge as shown', 'Your notes / changes']));
children.push(placeholder('Still open: photos for John Michael and Lael, and a decision plus photo and bio for Rachel. Square photos, at least 800 px.'));

// 7 Local
children.push(h1('7.  Rooted in Mt. Shasta'));
children.push(table3([
  ['Eyebrow', 'Rooted in Mt. Shasta'],
  ['Heading', 'We don’t drive in for the season. We live here.'],
  ['Intro', 'Other outfits guide Shasta from out of the area. Our office is on Chestnut Street, our guides patrol the local ski park, coach the local kids, and read this mountain every single day. That local knowledge is what keeps you safe and gets you home with a story.'],
  ['Card 1', 'On the mountain daily — Live conditions from guides who were up there this morning, not a forecast from another state.'],
  ['Card 2', 'Sponsoring local youth — Proud sponsors of Mt. Shasta Youth Soccer, the Mt. Shasta Ski Team and the Mt. Shasta Swim Team, because the next generation of mountain people starts here.', 'Done — teams named per your note.'],
  ['Card 3', '305 Chestnut Street — Stop by the shop in town before your trip. Real people, real gear, real answers.'],
  ['Background photo', '“Shasta.lentics” — lenticular cloud over the mountain seen from town'],
]));
children.push(placeholder('If any of the three teams has a logo we can use, send it and we will add them to the card.'));

// 8 CTA band
children.push(h1('8.  Call to action band'));
children.push(table3([
  ['Headline', 'Climbing with a guide will enhance your experience and increase your margin for safety', 'Done — your wording.'],
  ['Button', 'Start Planning  (scrolls to the contact form)'],
]));

// 9 Articles
children.push(h1('9.  Learn Before You Climb'));
children.push(small('Your best-performing articles, pulled onto the homepage. Each card links to the existing article on shastaguides.com. No changes requested in Round 2.'));
children.push(table3([
  ['Eyebrow', 'Learn Before You Climb'],
  ['Heading', 'Know the mountain before you meet it'],
  ['Intro', 'Our most-read guides, written by the people who climb Shasta every week. Start with the question everyone asks first.'],
  ['Featured article', ['Which route is right for you?  (Most Popular · Decision Guide)', 'Avalanche Gulch, Casaval Ridge, Clear Creek, the north side glaciers. Each has a season, a skill level and a personality. This guide walks you through choosing well.', 'Links to /articles/choosingaroute · Photo: your Mt. Shasta route map'], 'Done — route map added per your note.'],
  ['Article 2', ['How to train for mountaineering  (Preparation)', 'What to do in the 12 weeks before your climb so summit day feels hard, not impossible.', 'Photo: “crampons climbing”']],
  ['Article 3', ['When is the best time to climb?  (Planning)', 'Snow, weather and crowds month by month, and how that changes the route we recommend.', 'Photo: “view from camp”']],
  ['Article 4', ['What boots do I need?  (Gear)', 'The one piece of gear that makes or breaks a Shasta climb, and what we rent if you don’t own it.', 'Photo: “crampons on”']],
  ['Article 5', ['Why climb Shasta with a guide?  (Why Guided)', 'What a guide actually does on summit day, and why it changes the odds.', 'Photo: “rachel leading shasta”']],
]));
children.push(placeholder('The one-line teasers under each title are ours. Edit freely, and tell us if a different article should be featured.'));

// 10 Resources
children.push(h1('10.  Free Resources  (lead capture)'));
children.push(small('Three value-add downloads gated behind a name and email. Submissions are collected as leads. Your real PDFs are now behind the first two; the route quiz is interactive. All three work on the mockup now.'));
children.push(table3([
  ['Eyebrow', 'Free Resources'],
  ['Heading', 'Show up ready'],
  ['Intro', 'Tools we hand every climber before they arrive. Tell us where to send them and they’re yours.'],
  ['Resource 1', ['Train for Mt. Shasta  (PDF · 24-page guide + training plan)', 'Our guide to getting fit for the mountain, plus a week-by-week training plan by senior guide Dane Brinkley of Casaval Personal Training. Built for people with jobs and no mountain out the back door.', 'Form: Name, Email → button “Send me the training guide”', 'Delivers: “Training for Mount Shasta” (24 pp) and Dane’s plan (15 pp). The thank-you links to Casaval Personal Training for coaching.'], 'Done — Dane and Casaval PT credited and linked, per your note.'],
  ['Resource 2', ['Gear Checklist  (PDF · Printable checklist)', 'Every item, layer by layer, for your specific trip, with what you can rent in town from The Fifth Season and what to bring yourself.', 'Form: Which trip? (dropdown), Name, Email → button “Send me the checklist”', 'Dropdown: Summit Climb · Ski & Snowboard Mountaineering · Backcountry Ski Tour & Avalanche Course · Mountaineering Class & Day Hike · PCT Backpacking'], 'Done — all five gear lists from the Drive folder, matched to the trip chosen.'],
  ['Resource 3', ['Which Route Quiz  (Interactive · 1 minute)', 'Three questions and we’ll point you at the route and trip that fit your experience, timing and goals.', 'Q1 experience · Q2 month · Q3 goal → recommendation → optional email']],
  ['Quiz outcomes', ['Avalanche Gulch · Clear Creek · Hotlum-Bolam Ridge · Casaval Ridge · Ski Mountaineering Descent · “Mountaineering course first”', 'Each result has a two-sentence rationale and a link to the matching trip page.'], 'Please sanity-check the route logic and seasons.'],
  ['Thank-you text', 'On its way. Check your inbox, or grab them now: [direct download links]'],
]));
children.push(small('Lead notifications for all forms go to info@shastaguides.com, per your note.'));

// 11 Photo strip
children.push(h1('11.  Photo strip'));
children.push(small('Six curated square crops between Resources and Contact. No changes requested in Round 2.'));
children.push(table3([
  ['Photo 1', '“headlamps alpine start” — line of headlamps in the dark'],
  ['Photo 2', '“Shasta one” — wind-carved snow on the summit ridge'],
  ['Photo 3', '“CATO climb shadow” — climbers stepping into sunlight at dawn'],
  ['Photo 4', '“casavalcamp2” — orange tents on Casaval Ridge'],
  ['Photo 5', '“GB ski” — skier dropping in off Green Butte'],
  ['Photo 6', '“climb.casaval1” — climber above a sea of clouds'],
], COLS3, ['Slot', 'Image now used', 'Your notes / swap']));

// 12 Contact
children.push(h1('12.  Plan Your Climb / Contact  (form first)'));
children.push(small('The contact section leads with a form. The phone number is on the page but is no longer a primary call to action. No changes requested in Round 2.'));
children.push(table3([
  ['Eyebrow', 'Plan Your Climb'],
  ['Heading', 'Tell us about your trip.'],
  ['Intro', 'Send us a few details and a guide will reply within one business day with a recommended trip, dates and next steps. No pressure, no phone tag.', 'Confirm the one-business-day promise.'],
  ['Form title', 'Plan my climb'],
  ['Form fields', ['Name · Email · I’m interested in (dropdown of the eight trips + “Not sure yet”) · Ideal dates · Experience level · Group size · Anything else?'], 'Add or remove fields as you like.'],
  ['Submit button', 'Send my request'],
  ['Fine print', 'We reply by email within one business day. Prefer a call? Leave your number in the message and we’ll ring you.'],
  ['Thank-you', 'Thanks, we’ve got it. A guide will reply within one business day with a recommended trip and dates. Keep an eye on your inbox.'],
  ['Right column', 'Find Us — Come find us in town.'],
  ['Address', '305 Chestnut Street, Mt. Shasta, California 96067'],
  ['Email', 'info@shastaguides.com  (labelled “Email us”)'],
  ['Phone line', 'Already booked and need us right now? Call 530.926.3117.'],
  ['Map', 'Google map embed of 305 Chestnut St'],
  ['Social', 'Instagram · Facebook · Yelp'],
]));
children.push(small('Submissions go to info@shastaguides.com, per your note. SMS or Slack notifications can be added later.'));

// 13 Footer
children.push(h1('13.  Footer'));
children.push(table3([
  ['Logo', 'Shasta Mountain Guides (white version)'],
  ['Links', 'Trip Details · Gear · Training · FAQ · Articles · Policies · Essentials of Eligibility · Privacy Policy'],
  ['Permit notice', 'This business operates under special use permit with the Shasta-Trinity National Forest. This institution is an equal opportunity provider.'],
  ['Copyright', '© 2026 Shasta Mountain Guides', 'Will roll to 2027 at launch.'],
  ['To be removed at launch', '“Concept mockup, not a live site”'],
]));

// 14 Images
children.push(h1('14.  Images & files'));
children.push(p('Every photo on the mockup is one of your original files, web-optimised, with the originals kept untouched in the project. Guide headshots were pulled from your current About page. The full Drive folder has been copied into the project, so everything you uploaded is available for the inner pages.'));
children.push(gap());
children.push(small('Photos used, by section:'));
children.push(...bullets([
  'Hero slideshow — CATO high5, CATO flags, AGskintrack (your three USE_IN_HERO files)',
  'Trip cards — shasta climb gulch shadow, Shastaski.gulch, guide helping, Climb.north2, skintrack, Northside basecamp, mz.cosmic, Shasta trailhead',
  'Why SMG — shasta team',
  'Meet Your Guides — BCPP_2026_CATO (team summit photo) plus eleven headshots from shastaguides.com/about',
  'Rooted in Mt. Shasta — Shasta.lentics',
  'Articles — shastaroutemap, crampons climbing, view from camp, crampons on, rachel leading shasta',
  'Photo strip — headlamps alpine start, Shasta one, CATO climb shadow, casavalcamp2, GB ski, climb.casaval1',
]));
children.push(gap());
children.push(small('Added from the Drive folder on October 13 and now in use: cosmic (Rock Climbing hero), mz.cosmic (Rock Climbing card and Fun Climbing Day), cosmicgear (Cosmic Wall), glacier training (Glacier II), clear creek (Clear Creek climb), hikeclearcreek (Climb Shasta photo strip), Porcupine Lake (PCT Backpacking), dayhike (Day Trips hero).'));
children.push(small('New in the Drive folder since Round 2, held for inner pages or swaps:'));
children.push(...bullets([
  'shastaroutemap (route map — ideal for the “Which route?” article and the quiz), smgadmin (team group), basecampdinner, campwater, glissadehorns, miseryhill, redbanksiceaxe, redbanksfisheye, pow ski, approachhike, avalanche climbers gully, casaval.ridge, climbhotlumguides, Helen switchbacks, shasta northeast side, shasta south side, uptrack south side',
  'PDFs — Summit Climb, Ski & Snowboard Mountaineering, Backcountry Ski Tour & Avalanche Course, Mountaineering Class & Day Hike and PCT Backpacking gear lists; Training for Mount Shasta guide; Casaval training plan',
]));

// ===== Part 2: program pages =====
children.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 60 }, children: [new TextRun({ text: 'Part 2 · Program pages', font: FONT, size: 34, bold: true, color: NAVY })] }));
children.push(p('Each trip card on the homepage now opens its own page. Every page follows the same layout: a hero, an overview with at-a-glance facts, one card per trip or course, what is included, a photo strip, and an inquiry form with the matching gear list and training guide.'));
children.push(p('Copy, prices and dates were taken from your current website in October 2026. Your Round 3 notes are applied: the 4-Day Advanced Ski Seminar and OAT x SMG Backpacking are cut, the 3-Day Expedition Style climb stays at $1,595, and the Casaval Ridge text is yours. For anything else, write KEEP, CUT, or the new 2027 price in the notes column. Blank means keep.'));
children.push(new Paragraph({ spacing: { before: 60, after: 160 }, children: [run('Every page links Book Now to your current Climb Shasta page until we have the Flybook links.', { color: GRAY, italics: true, size: 18 })] }));

TRIPS.forEach((t, i) => {
  const n = 16 + i;
  children.push(h1(`${n}.  ${t.title}  (${t.slug}.html)`));
  const top = [
    ['Eyebrow', t.eyebrow],
    ['Headline', t.h1],
    ['Sub-line', t.lede],
    ['Buttons', 'Book Now  ·  Plan My Trip (scrolls to the inquiry form)'],
    ['Hero photo', t.hero.alt + (t.heroNote ? '  —  ' + t.heroNote : ''), t.heroNote ? 'Please send a real rock climbing photo.' : ''],
    ['Overview', t.intro],
  ];
  if (t.status) top.push(['Status line', t.status, 'Update each season.']);
  top.push(['At a glance', t.glance.map(g => `${g[0]}: ${g[1]}`)]);
  children.push(table3(top));
  if (t.programs) {
    children.push(gap());
    children.push(small(`${t.programs.length} trip cards on this page, in order. Write KEEP, CUT or the 2027 price in the notes column.`));
    children.push(table3(t.programs.map((pr, j) => [
      `${j + 1}. ${pr.name}${pr.tag ? '  (' + pr.tag + ')' : ''}`,
      [
        [pr.length && 'Length: ' + pr.length, pr.route && 'Route: ' + pr.route, pr.cost && 'Cost: ' + pr.cost].filter(Boolean).join('  ·  '),
        pr.blurb,
        'Experience: ' + pr.experience,
        'Physical demand: ' + pr.demand,
      ],
    ]), COLS3, ['Trip', 'As shown on the page', 'KEEP / CUT / 2027 price']));
  }
  if (t.pricing) {
    children.push(gap());
    children.push(small('Pricing tables on this page.'));
    t.pricing.forEach(pt => {
      children.push(table3(pt.rows.map(r => [r[0], pt.head ? pt.head.slice(1).map((h, k) => `${h}: ${r[k + 1]}`).join('  ·  ') : r[1]]), COLS3, [pt.title, 'As shown', 'KEEP / CUT / 2027 price']));
      if (pt.note) children.push(small(pt.note));
    });
  }
  const rest = [];
  if (t.includes) rest.push(['What’s included', t.includes.concat(t.notIncluded ? ['Not included: ' + t.notIncluded] : [])]);
  if (t.dates) rest.push([t.dates.title, t.dates.rows.map(r => r[0]).concat(t.dates.note ? [t.dates.note] : []), 'Please confirm, and send dates for the other routes.']);
  if (t.extra) rest.push([t.extra.title, t.extra.text]);
  rest.push(['Gear list offered', t.gear.label + (t.gear.alt ? '  ·  ' + t.gear.alt.label : '')]);
  rest.push(['Article linked', t.article.title]);
  rest.push(['Inquiry form', `Same Plan My Trip form as the homepage, with “${t.formOption}” pre-selected. “Ask about this trip” on any card adds that trip’s name to the message.`]);
  if (rest.length) { children.push(gap()); children.push(table3(rest)); }
});

const doc = new Document({
  creator: 'The Clay Media',
  title: 'Shasta Mountain Guides – Website Content Sheet (Round 3)',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children
  }]
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, buf.length); });
