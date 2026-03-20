# Knobb Mobile Site Reference

These files are mobile-only, standalone reference versions of the current public website so they are easier to hand off to Google Stitch for redesign work.

Files:
- `docs/stitch/mobile-landing.html`
- `docs/stitch/mobile-contact.html`

Current source of truth in the app:
- `src/pages/LandingPage.tsx`
- `src/pages/landing/LandingContactPage.tsx`
- `src/pages/landing/LandingMenu.tsx`
- `src/pages/landing/css/globals.css`
- `src/pages/landing/css/home.css`
- `src/pages/landing/css/menu.css`
- `src/pages/landing/css/contact.css`
- `src/pages/landing/css/footer.css`

Notes:
- The exported HTML keeps the current content, section order, and mobile information architecture.
- Desktop-only 3D and motion-heavy effects were intentionally removed so Stitch gets a cleaner mobile layout reference.
- Asset URLs still point at the same project images under `/images/...`.
