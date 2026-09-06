# Kuwait Weather

A weather app for Kuwait — heat, dust, the shamal, and the midday work ban.

It is a standalone project. It shares this repository with the FLCC Members app,
Shepherd, LAMP, FLCC NEXT and FLCC NEXT Adults, and it shares nothing else with
them: no code, no storage, no data files, no deployment. `test/boundary.test.mjs`
is what keeps that true.

```
index.html            one page, no framework, no build step
style.css             one stylesheet
js/core/              the logic, all of it pure and all of it tested
js/ui/                the icons and the markup
test/                 node --test 'kuwait-weather/test/*.test.mjs'
```

Open `index.html` from any static server. There is nothing to install, nothing
to configure and no key to obtain.

## Why this app is different from every other weather app

The number on the front of a weather app is the air temperature, and in Kuwait
the air temperature is the least useful number available. 48 °C in June and
44 °C in August are not the same day: the first is dry and the second is not,
and it is the second that sends people to hospital. Meanwhile the thing that
actually stops work — a wall of dust arriving off the desert at four in the
afternoon — does not appear on a conventional forecast at all.

So this app leads with four things a conventional one buries or omits:

**Heat you can act on.** Three numbers, and they are not interchangeable. Air
temperature is what a thermometer reads. Heat index is what it feels like once
humidity stops sweat from evaporating. WBGT — wet bulb globe temperature — is
what occupational heat standards are actually written against, because it
accounts for humidity, wind and the sun's radiant load together. The app shows
all three and bases its guidance on the third.

**Dust.** Two independent signals, and the app trusts whichever is worse:
visibility in metres, which is the operational definition the WMO uses and the
one that closes a road; and particulate concentration in µg/m³, which is what a
mask is for. Five levels, from clear air to dust storm, on every hour of the
next two days and every day of the week.

**The shamal.** The northwesterly that lifts the dust, named as what it is,
with its two seasons: the winter shamal that arrives behind a front between
November and March, and the steadier summer one through June and July.

**The midday work ban.** Kuwait bars work in direct sunlight in open areas
between 11:00 and 16:00, from 1 June to 31 August. It is the one piece of
Kuwait weather that is also a law, and for anyone working outdoors it is the
single most useful thing an app can tell them. The app counts down to it, marks
the banned hours in the hourly strip, and points at the Public Authority for
Manpower for the current year's decree.

## The three decisions behind it

**It reads outdoors.** That is why it is a light, high-contrast page by default
rather than the dark glass every weather app reaches for — it gets read on a
phone in sun bright enough to wash a screen out. Dark mode is there for reading
at night, not as the main event.

**It says what it does not know.** WBGT is estimated from a forecast, not
measured, and every screen that shows it says so. Above 44 °C the heat index is
past the range its formula was fitted for and reads high, and the app says that
too, where it matters. The work/rest guidance is for planning a day, not for
meeting an obligation. This is not an official warning service; Kuwait's
Meteorological Department issues those.

**Nothing about you goes anywhere.** The app sends a pair of coordinates,
rounded to four decimals, and gets a forecast back. There is no account, no
analytics, no key and no server of ours in the path. Your place, your units,
your work profile and the last reading it downloaded stay in this browser under
`kw/v1/`, and `js/core/storage.js` throws on any key outside that namespace.

## Where the data comes from

[Open-Meteo](https://open-meteo.com/), on two endpoints, called straight from
the browser:

| Endpoint | Carries |
| --- | --- |
| `api.open-meteo.com/v1/forecast` | temperature, humidity, wind, gusts, cloud, visibility, UV, 7 days |
| `air-quality-api.open-meteo.com/v1/air-quality` | PM10, PM2.5 and mineral dust, 5 days |

It is free, keyless and open — weather from national meteorological services,
dust and particulates from the Copernicus atmosphere model. Both are asked for
`Asia/Kuwait`, so every timestamp that comes back is Kuwait wall-clock time and
`format.parseLocal` is the only thing that reads them.

The air-quality call is allowed to fail on its own. Losing the dust numbers
should never cost you the temperature, so it is caught separately and every
dust field goes null rather than the screen going blank.

Google's WeatherNext was the starting point for this app and is not what it
uses. WeatherNext is a research forecasting model reached through BigQuery,
Earth Engine or Vertex AI — it needs a Google Cloud project with billing, a
service account, and a scheduled job to subset a global grid down to Kuwait and
publish it. None of that can happen inside a static page, and none of it was
worth a billing account for a forecast Open-Meteo serves for nothing. Google's
Maps Platform Weather API is the callable alternative and still needs a key,
which a static page cannot hold. If either is ever wanted, `js/core/api.js` is
the only file that would change.

## The modules

| File | What it owns |
| --- | --- |
| `core/api.js` | the two URLs, and folding both responses into one shape |
| `core/derive.js` | everything the forecast does not say outright, per hour and per day |
| `core/heat.js` | heat index, wet bulb, globe temperature, WBGT, work/rest bands |
| `core/dust.js` | five dust levels, from visibility and particulates |
| `core/wind.js` | the compass, Beaufort, and what counts as a shamal |
| `core/workban.js` | the 11:00–16:00 summer ban, in Kuwait's own clock |
| `core/advisories.js` | which of the above is worth saying, and in what order |
| `core/places.js` | 24 places across all six governorates |
| `core/format.js` | numbers and Kuwait times, formatted once |
| `core/storage.js` | the only module that touches browser storage |

## A note on the WBGT model

The first draft used the Australian Bureau of Meteorology's shade
approximation, which is what most quick calculators reach for. It was thrown
out: it has no wind term and no wet bulb in it, and at 48 °C and 22 % humidity —
an ordinary Kuwait July noon — it returns a WBGT above 43 °C, a figure that has
never been recorded anywhere on earth.

What replaced it is the standard outdoor weighting, 70 % wet bulb / 20 % globe /
10 % air, over a wet bulb from Stull's 2011 regression and a globe temperature
estimated from cloud, wind and time of day. It lands 48 °C at 22 % and 40 °C at
60 % within a degree of each other, which is the right answer: the humid day is
as dangerous as the hotter one. `test/heat.test.mjs` pins both, and pins the
old model's failure so it cannot come back.

## Tests

```bash
node --test 'kuwait-weather/test/*.test.mjs'
```

127 of them, no dependencies and no build step. The forecast API cannot be
called from a test, so `test/fixtures/forecast.mjs` builds responses in the
real shape instead — which also lets a test ask for a specific kind of day: a
July afternoon in a dust storm, a mild January morning, an air-quality endpoint
that returned nothing.

| File | Covers |
| --- | --- |
| `heat.test.mjs` | heat index against the NWS table, wet bulb against psychrometrics, the work/rest bands |
| `dust.test.mjs` | the five levels, and the worse of the two signals winning |
| `wind.test.mjs` | the compass, and what is and is not a shamal |
| `workban.test.mjs` | the ban's edges, in Kuwait time, in and out of season |
| `places.test.mjs` | all six governorates, unique ids, every place inside Kuwait |
| `api.test.mjs` | the URLs, the normalized shape, air-quality hours matched by timestamp |
| `derive.test.mjs` | per-hour enrichment, daily rollups, the best outdoor window |
| `advisories.test.mjs` | what is raised, what is not, and in what order |
| `render.test.mjs` | every section, escaped, balanced, and free of `undefined` |
| `format.test.mjs` | Kuwait times, temperatures, and "updated" never reading as the future |
| `storage.test.mjs` | the `kw/v1/` namespace |
| `boundary.test.mjs` | no other app in this repository, no package, no key, no third-party host |
