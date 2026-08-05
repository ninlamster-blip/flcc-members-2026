# flcc-members-2026

Two separate applications live in this repository.

**FLCC Members** — the schedule, attendance, prayer, music and ministry app
shared by the 14 churches of the BOTR network. Starts at `index.html`; see
[CHURCHES.md](CHURCHES.md) for how the multi-church setup works.

**Shepherd** — a separate platform for church leaders in Kuwait and the wider
Gulf, under [`shepherd/`](shepherd/). It shares no code, data or storage with
the FLCC app; see [shepherd/README.md](shepherd/README.md).

## Tests

```bash
node --test 'test/*.test.mjs'          # FLCC Members — see test/README.md
node --test 'shepherd/test/*.test.mjs' # Shepherd
node ask-proxy/worker.test.mjs         # the Cloudflare Worker
```

No dependencies and no build step anywhere — plain `node:test`.
