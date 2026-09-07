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
| `ui/chart.js` | the rain bars with PAGASA's lines across them, and the temperature curve |

## Tests

```bash
node --test 'ph-weather/test/*.test.mjs'
```

87 of them, no dependencies and no build step. The API cannot be called from a
test, so `test/fixtures/forecast.mjs` builds responses in the real shape —
including the past week — which lets a test ask for a specific kind of month:
three dry days then a downpour, a saturating habagat spell, an air-quality
endpoint that returned nothing.

The two that matter most:

`flood.test.mjs` pins what the model does **and what it refuses to do**. Soaked
ground with no rain coming is not a flood warning — raising one would cry wolf
every week of the habagat and teach people to ignore the app. That test caught
exactly that bug during the build.

`design.test.mjs` computes real contrast ratios rather than eyeballing them,
including for the three PAGASA warning colours, which have to be recognisable
as yellow, orange and red *and* legible as thin chart rules. It caught a yellow
at 3.59:1 that looked fine.
