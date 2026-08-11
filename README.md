# Obotu Okwori — Portfolio

Personal portfolio and résumé site for Obotu Okwori — Statistics graduate and data scientist (Python, Django, applied statistics). Plain HTML/CSS/JS, no build step, no frameworks, no third-party services.

**Live site:** https://jenks00.github.io/obotu-portfolio/

## Structure

```
.
├── index.html          Portfolio page
├── resume.html          Résumé page (has a "Print / Save as PDF" button)
├── css/
│   ├── style.css        Portfolio styles
│   └── resume.css       Résumé styles
├── js/
│   └── main.js           Scroll reveal, animated counters, active-nav highlighting,
│                          and a hand-rolled WebGL 3D point-cloud hero (with a 2D
│                          canvas fallback for browsers without WebGL)
├── assets/
│   ├── favicon.svg
│   └── images/           Real screenshots from the projects featured on the site
└── .github/workflows/deploy.yml   GitHub Actions workflow that publishes to GitHub Pages
```

No build tools, package managers, or external font/script CDNs are used — the page is fully self-contained and works by opening `index.html` directly in a browser, or served as-is by any static host.

## Local development

Just open `index.html` in a browser, or serve the folder locally:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

This repo is set up to deploy automatically to **GitHub Pages** via GitHub Actions on every push to `main` (see `.github/workflows/deploy.yml`). No manual build step is required — it just publishes the static files as-is.

To deploy elsewhere (Netlify, Vercel, Cloudflare Pages, S3, etc.), point the host at the repository root — there's nothing to build.

## Notes

- The three project screenshots under `assets/images/` are real captures from live instances of the private systems described on the site (seeded with sample data for the screenshot, not production data).
- Browsers without WebGL support automatically fall back to a 2D canvas version of the hero animation.
- Animations respect `prefers-reduced-motion`.

## License

MIT — see `LICENSE`. Feel free to use the code as a template for your own site; please don't reuse the personal content (name, bio, project descriptions, screenshots).
