# Tests for Kuwait Weather

```bash
node --test 'kuwait-weather/test/*.test.mjs'
```

No dependencies and no build step — plain `node:test` over the same ES modules
the browser loads, which is why `js/core/` holds no DOM and no `fetch` outside
`api.load`.

`fixtures/forecast.mjs` builds Open-Meteo responses in the real shape rather
than recording one, so a test can ask for the day it needs: a July afternoon in
a dust storm, a mild January morning, an air-quality endpoint whose hours start
six hours after the weather model's, or one that returned nothing at all.

Two of these are load-bearing beyond their own module.

`boundary.test.mjs` is what makes "standalone" a fact rather than an intention.
It walks every source file and fails on an import of `church.js`, a read of
`FLCC.*`, a path into `shepherd/`, `lamp/`, `flcc-next/`, `flcc-adults/` or
`ask-proxy/`, a package import, a third-party host, anything that looks like a
credential, and any `localStorage` touched outside `core/storage.js`. It also
checks the service worker caches every module that exists and caches no
forecast, that every `#id` the app reaches for is in the page, and that every
icon the screens ask for is one that has been drawn.

`heat.test.mjs` pins the WBGT model, including the failure of the one it
replaced: at 48 °C and 22 % humidity the Bureau of Meteorology's shade
approximation returns above 43 °C, and the test that a Kuwait July noon lands
between 30 and 40 is what stops that model coming back.
