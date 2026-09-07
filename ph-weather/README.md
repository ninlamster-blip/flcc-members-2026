# Philippines Weather

A weather app for the Philippines — flooding, rain, the ground underneath it,
heat, humidity and air.

It is a standalone project. It shares this repository with the FLCC Members
app, Shepherd, LAMP, FLCC NEXT, FLCC NEXT Adults and Kuwait Weather, and it
shares nothing else with any of them: no code, no storage, no data, no
deployment. `test/boundary.test.mjs` is what keeps that true — including
against Kuwait Weather, whose design language this app deliberately shares and
whose code it deliberately does not.

```
index.html            one page, no framework, no build step
style.css             one stylesheet
js/core/              the logic, all of it pure and all of it tested
js/ui/                the illustrations, the charts and the markup
test/                 node --test 'ph-weather/test/*.test.mjs'
```

Open `index.html` from any static server. Nothing to install, nothing to
configure, no key to obtain.

## What it is for

An ordinary weather app tells you it will rain. In a country where the rain
routinely closes a road, fills a ground floor and takes a hillside with it,
that is not the useful part. So this app leads with **whether the street is
likely to flood**, and works backwards from there.

**Flooding.** Three numbers, combined openly and shown with their workings:

1. The heaviest hour of rain in the next stretch, on **PAGASA's own rainfall
   warning thresholds** — 7.5–15 mm/h is their yellow, 15–30 orange, above 30
   red. These are the numbers the country's real warnings are written against.
2. The total across the next 24 hours, because six hours of steady moderate
   rain floods places one violent hour does not.
3. **How saturated the ground already is.** This is the one most weather apps
   cannot do, and it is why this app asks the API for `past_days=7` alongside
   the forecast. Rain falling on dry ground soaks in; rain falling on ground
   that has taken 200 mm this week runs straight off, and it is the running off
   that fills a street.

The third is what makes it worth building. Nine millimetres an hour is merely
"heavy" — but on soaked ground it becomes *serious flooding likely*, and the
card says so in as many words, naming which of the three drove the reading.

**Landslides.** The same saturation, plus the rainfall that triggers a slide on
ground already primed for one.

**Heat that is really humidity.** 34 °C in Manila is harder on a body than
40 °C in a desert, because at 90 % humidity sweat stops evaporating. The heat
index uses **PAGASA's bands**, which are drawn differently from the American
ones, and the dew point is shown beside it because relative humidity on its own
is a poor guide — 80 % at 24 °C is pleasant and 80 % at 32 °C is not.

**Air and allergies.** US AQI, the particulates and ozone that set asthma off,
and the indoor dampness that mould and dust mites need.

**The monsoons**, named: habagat in June–September, amihan in October–February,
and the *enhanced* habagat — southwest wind carrying a great deal of rain — that
is the pattern behind most Metro Manila floods.

## The one thing it asks you

The flood model reads rainfall and how wet the ground is. What it cannot read
is *the street*: whether the drains were cleared this year, whether the road was
raised, whether the subdivision sits in an old riverbed. That knowledge exists —
it is just in somebody's head rather than in an API, and the maps that would
hold it (Project NOAH, the MGB hazard sheets) are not something this app can
reach.

So it asks, once per place: **how does your own street handle heavy rain?**
Four answers, kept on the device, never sent anywhere. It is stored per place
because Marikina floods and Baguio slides, and one setting for everywhere would
be worse than none.

Two rules bound it, and both are pinned by `test/localhazard.test.mjs`:

- **Optimism cannot silence a warning.** Somebody who says "our street never
  floods" is usually right — until the afternoon they are not, and that is
  exactly the afternoon this has to keep shouting. When the rainfall alone is
  in PAGASA's orange or red range, the floor holds regardless of what anyone
  told the app. The test checks that across every level and every rainfall,
  not one case.
- **It adjusts a risk; it does not invent one.** A street that floods easily is
  not flooding when nothing is falling on it.

## What it is not

**It is not a flood forecast, and it is not PAGASA.**

A real flood forecast needs the shape of the land, the drainage, the river
level and — in Marikina's case — what the Wawa dam is releasing. None of that
is in a weather API and none of it is here. Two streets with identical rain
flood completely differently, and this app cannot tell them apart. Whether a
slope can fail depends on the slope, which is in PHIVOLCS and MGB
susceptibility maps rather than in a forecast.

So every hazard card states its own limits in body type, on screen, not
buried in a footer. PAGASA, PHIVOLCS and the local DRRMO are who to act on.

**It cannot give you a pollen count.** The atmosphere model behind the
air-quality data publishes pollen for Europe only; over the Philippines those
fields come back empty. Rather than draw a confident zero, the app says so and
reports the triggers it *can* measure instead.

## Where the data comes from

[Open-Meteo](https://open-meteo.com/), on two keyless endpoints called straight
from the browser:

| Endpoint | Carries |
| --- | --- |
| `api.open-meteo.com/v1/forecast` | rain, temperature, humidity, dew point, wind, gusts, visibility, UV, CAPE — **7 days back and 7 forward** |
| `air-quality-api.open-meteo.com/v1/air-quality` | PM2.5, PM10, ozone, NO₂ and US AQI |

A coordinate rounded to four decimals goes out; a forecast comes back; nothing
else is sent. Both are asked for `Asia/Manila`, so every timestamp is Philippine
wall-clock time and `format.parseLocal` is the only thing that reads them. The
air-quality call is caught separately — losing the particulate numbers should
never cost somebody the flood warning.

### The radar map, which is the one exception

Open-Meteo publishes hourly model output and no radar at all, so *where is the
rain right now* cannot be answered from it. Radar is a different kind of thing
— an actual sweep of the sky, minutes old rather than modelled — and it needs a
different source. Two, in fact:

| Host | Carries |
| --- | --- |
| `api.rainviewer.com` | the index of radar frames currently published — about two hours back, and a short nowcast forward |
| the tile host the index names | the radar frames themselves, as map tiles |
| `tile.openstreetmap.org` | the plain base map underneath them |

Nothing but a tile coordinate is sent to either, and no URL the app builds has
a query string — there is nowhere to put a key, which is the point.
`test/boundary.test.mjs` names all three in its allowlist with the reasoning
written next to them, because that list is the rule and adding to it should be
a deliberate act rather than a convenience.

The base map was CARTO first, and it lasted one deploy: CARTO's tiles came back
reading **"API key required"**. That is the shape of the risk in this whole
list — a host that is keyless today can gate tomorrow, and a static page has
nowhere to keep a key. OpenStreetMap's standard tiles never wanted one. The
cost is that they publish no dark style, so **the map stays light in both
themes**; inverting them in CSS makes a muddy, misread map rather than a dark
one, and a base map behind a rain radar has one job.

**Radar coverage is not uniform, and where none reaches, the frames come back
empty — which looks exactly like a dry sky.** The card says so on screen, in
body type. That is the whole reason the sentence exists, and
`radar.test.mjs` fails if it is removed.

There is no mapping library. A slippy map is four equations and some absolutely
positioned images; `ui/tiles.js` is the four equations, written out and tested
against a round trip, and `ui/map.js` is the images.

## The modules

| File | What it owns |
| --- | --- |
| `core/rain.js` | PAGASA's intensity thresholds and their warning colours |
| `core/saturation.js` | how much water the ground is already holding |
| `core/flood.js` | flood likelihood, and which of the three factors drove it |
| `core/landslide.js` | the trigger half of a slide, honestly bounded |
| `core/heat.js` | heat index on PAGASA bands, dew point, comfort |
| `core/monsoon.js` | habagat and amihan, including the enhanced kind |
| `core/air.js` | AQI, the measurable allergy triggers, indoor damp |
| `core/api.js` | the two URLs, including the week of history |
| `core/derive.js` | everything the forecast does not say outright |
| `core/places.js` | 37 places, weighted towards the ones that flood and slide |
| `core/radar.js` | RainViewer's frame index, tile URLs and how old a sweep is |
| `ui/tiles.js` | Web Mercator: the four equations a slippy map actually needs |
| `ui/map.js` | the map itself — two tile layers, a drag, a zoom and a timeline |
| `ui/chart.js` | the rain bars with PAGASA's lines across them, and the temperature curve |

## Tests

```bash
node --test 'ph-weather/test/*.test.mjs'
```

119 of them, no dependencies and no build step. The API cannot be called from a
test, so `test/fixtures/forecast.mjs` builds responses in the real shape —
including the past week — which lets a test ask for a specific kind of month:
three dry days then a downpour, a saturating habagat spell, an air-quality
endpoint that returned nothing.

The two that matter most:

`flood.test.mjs` pins what the model does **and what it refuses to do**. Soaked
ground with no rain coming is not a flood warning — raising one would cry wolf
every week of the habagat and teach people to ignore the app. That test caught
exactly that bug during the build.

`radar.test.mjs` pins the projection against a round trip — a coordinate turned
into a tile position and back has to come out where it started, at every zoom —
and pins the sentence that stops a blank map implying a dry one.

`design.test.mjs` computes real contrast ratios rather than eyeballing them,
including for the three PAGASA warning colours, which have to be recognisable
as yellow, orange and red *and* legible as thin chart rules. It caught a yellow
at 3.59:1 that looked fine.
