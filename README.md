# flcc-members-2026

Four separate applications live in this repository.

**FLCC Members** — the schedule, attendance, prayer, music and ministry app
shared by the 14 churches of the BOTR network. Starts at `index.html`; see
[CHURCHES.md](CHURCHES.md) for how the multi-church setup works.

**Shepherd** — a separate platform for church leaders in Kuwait and the wider
Gulf, under [`shepherd/`](shepherd/). It shares no code, data or storage with
the FLCC app; see [shepherd/README.md](shepherd/README.md).

**LAMP** — a Bible and faith companion for ages 7–18, under [`lamp/`](lamp/).
A third separate application, with its own `lamp/v1/…` storage namespace and no
link to either app above. Phase 1 is built; see [lamp/README.md](lamp/README.md)
and the full [specification](lamp/SPEC.md).

**FLCC NEXT** — the kids (7–12) and teens (13–18) app for FLCC Church, under
[`flcc-next/`](flcc-next/). A fourth separate application, with its own
`next/v1/…` storage namespace, its own design system and a ministry dashboard
at `flcc-next/admin.html`. See [flcc-next/README.md](flcc-next/README.md) and
[flcc-next/ARCHITECTURE.md](flcc-next/ARCHITECTURE.md).

## Tests

```bash
node --test 'test/*.test.mjs'           # FLCC Members — see test/README.md
node --test 'shepherd/test/*.test.mjs'  # Shepherd
node --test 'lamp/test/*.test.mjs'      # LAMP — see lamp/README.md
node --test 'flcc-next/test/*.test.mjs' # FLCC NEXT — see flcc-next/README.md
node ask-proxy/worker.test.mjs          # the Cloudflare Worker
```

No dependencies and no build step anywhere — plain `node:test`.
