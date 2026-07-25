# Setting up this app for another church

This app was built for FLCC – Abundance Church and is being opened up to the
other churches in the BOTR network. Every church runs its **own copy**: its own
GitHub repository, its own website address, its own publishing token, its own
member data. Nothing is shared between churches except the code itself and the
network-level material in `botr.json`.

That is a deliberate choice. The alternative — one site holding all twelve
churches — needs work this app has not had yet, and until it does, a shared
setup would mean every church's steward could overwrite every other church's
data. Separate copies cost more to keep in sync, and buy safety worth having.

---

## Read this part before you start

**Everything published by this app is publicly readable.** There is no login.
Anyone with the link — and anyone who finds it through a search engine — can
read your members' names, birthdays, wedding anniversaries, service assignments
and attendance records.

That is how the app works today. It is not a bug you can configure away, and
setting up a copy does not change it.

So: **tell your congregation before you put their details in.** There is a
draft you can circulate at [`CONGREGATION-QUESTIONS.md`](CONGREGATION-QUESTIONS.md),
covering this and the other decisions that belong to your church rather than to
whoever sets the app up. If your members are not comfortable being listed
publicly, say so to the network before rolling out — a password gate is
buildable, but nobody has built it yet.

---

## Setup

### 1. Make your own copy

Fork `ninlamster-blip/flcc-members-2026` on GitHub, or use **Use this
template** if it has been made a template repository. Name it for your church,
e.g. `flcc-shekinah-2026`.

Then clone it and check what you have:

```bash
git clone https://github.com/<your-github-name>/<your-repo>.git
cd <your-repo>
node tools/setup-church.mjs --list
```

That prints the thirteen churches in the network, by sector.

### 2. Make it yours — and empty

```bash
node tools/setup-church.mjs --church "Shekinah"
```

Add `--dry-run` first if you want to see what it would do without writing
anything.

This does two jobs. It rebrands the copy for your church. More importantly, it
**removes Abundance's people** — because a fork inherits them, and publishing
that fork would put another congregation's names, birthdays and attendance on
the public web a second time. Specifically it clears:

| What | Where it was hiding |
|---|---|
| 68 workers, the year's schedule, events | `data.json` |
| 10 services of present/absent records | `attendance.json` |
| Prayer ministry workers, intercessory list, meeting notes | `prayer.json` |
| Musicians and the music rota | `music.json` |
| Six ministry heads' names and mobile numbers | `equip.json` |
| 41 member names used for a leaderboard | `index.html` source |
| Named prayer requests and praise reports | `index.html` source |
| Seed workers, rotas and named family homes as venues | `prayer.html`, `music.html` source |
| Church announcements naming individuals | `news.json` |
| Course facilitators | `index.html`, `members.html` |
| A stale export holding the full member list | `flcc-schedule-2026-05-12.json` (deleted) |

Kept, because they belong to the whole network and are the useful part of
starting from a copy: the BOTR vision, purpose and statement of faith
(`botr.json`), the monthly themes, the worship songs and chords, the Equip
course material, the ministry team names, and every Bible study and reading
tool.

After it runs, check for yourself before publishing anything:

```bash
grep -rn "Abundance" --include="*.html" --include="*.json" . | grep -v botr.json
```

Nothing should come back. If something does, it means the app has changed since
the script was written — clear it by hand and tell whoever maintains the code.

### 3. Turn on the website

GitHub → your repo → **Settings → Pages** → Source: *Deploy from a branch*,
Branch: `main`, folder: `/ (root)`. A minute later your site is at:

```
https://<your-github-name>.github.io/<your-repo>/
```

### 4. Check where it publishes

The admin pages write your data back to GitHub. They work out which repository
from the address they are open at, so a copy on `github.io` needs no
configuration.

Confirm it anyway — open `attendance.html` on your live site and look at the
token setup panel. It should name **your** repository. If it does not, or if
you use a custom domain, set it by hand in `church-config.js`:

```js
repo: 'your-github-name/your-repo',
```

You can check the logic without a browser:

```bash
node tools/church-config.test.mjs
```

### 5. Create your publishing token

GitHub → **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**:

- **Repository access:** Only select repositories → **your repo, and only
  yours**
- **Permissions:** Repository permissions → Contents → **Read and write**

Copy the token (it starts `github_pat_`) and paste it into the admin page when
it asks. It is stored only in that browser.

**One token per church, scoped to that church's repository alone.** A token
that can reach a second church's repo is the one mistake in this whole setup
worth being careful about — it can overwrite another congregation's data and
the site's code. Do not share tokens between churches, and do not use an
account-wide "all repositories" token.

### 6. Add your own people

Open `schedule-editor.html` on your live site to enter workers and the
schedule, and `attendance.html` after each service. Both publish straight to
your repo; the members' view picks the change up within seconds.

---

## Optional: the AI assistant and prayer chain

`ask.html` (the assistant) and the Kasama prayer chain need a Cloudflare Worker
— see `wrangler.toml` and `ask-proxy/`. Both are optional; the rest of the app
works fine without them.

Two things to settle with the network before turning them on:

- **The assistant costs money per question**, billed to whoever owns the
  Anthropic API key. There is currently no rate limit in the Worker, so usage
  is uncapped. Agree who pays before you point your congregation at it.
- **The prayer chain database has no church column.** Every church pointing at
  the same Worker lands in one shared prayer feed, and a new request notifies
  all of them. That may be what the network wants — twelve churches interceding
  together — but it should be a decision, not a surprise. If you want your
  church's prayers private, run your own Worker and your own D1 database.

---

## Things worth knowing

**Two pastor cards on the home page** are keyed to worker ids `ptr-01` and
`ptr-02` (`index.html`). Use those ids for your own pastors and the cards fill
in; use different ids and the cards simply do not appear.

**Publishing commits straight to `main`.** There is no review step and no CI.
Whoever holds the token can change the site.

**Keeping up with improvements.** Fixes made to Abundance's copy do not reach
yours by themselves. Add the original as a remote and merge when you want them:

```bash
git remote add upstream https://github.com/ninlamster-blip/flcc-members-2026.git
git fetch upstream
git merge upstream/main
```

Expect conflicts in the data files — keep your own versions of those. This is
the running cost of separate copies, and the reason the network may eventually
want the single-site version instead.
