# LAMP

**A Bible & faith companion for ages 7–18.** *Discover God. Know His Word.
Live It.*

**Status: specification only.** There is no code in this directory yet — just
[SPEC.md](SPEC.md), the buildable product specification: information
architecture, screen-by-screen behaviour, the age-adaptation model, the AI
contract, the child-safety requirements, the data model, the design system,
and a four-phase roadmap with a defined MVP.

When it is built, LAMP will be a **third, separate application** in this
repository, alongside the FLCC Members app and Shepherd. It will live entirely
under `lamp/`, store everything under its own `lamp/v1/…` namespace, and
never import `church.js`, read `FLCC.*`, or touch anything under `shepherd/`.
See [SPEC.md §3](SPEC.md) for the full boundary.

Start with the vision (§1), the principles (§2), then the MVP definition
(§18).
