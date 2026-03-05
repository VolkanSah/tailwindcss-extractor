# Tailwind CSS Extractor

Automatically extracts and optimizes Tailwind CSS from your HTML files via GitHub Actions.

**Easy to use:** Put your HTML files in `/docs`, push — done.

---

## How It Works

1. Add your HTML files to `/docs`
2. Push to `main`
3. GitHub Actions extracts & optimizes your Tailwind CSS
4. Find the result in `/assets/tailwind.css`

---

## Structure

```
tailwindcss-extractor/
├── .github/
│   ├── workflows/
│   │   └── extract-tailwind.yml   ← Action
│   └── scripts/
│       └── extract-tailwind.js    ← Worker Script
├── docs/
│   └── *.html                     ← Your HTML files
├── assets/
│   └── tailwind.css               ← Auto-generated output
├── package.json
└── .gitignore
```

---

## Requirements

- GitHub repository with Actions enabled
- HTML files using Tailwind CSS (v3 or v4)
- No local setup needed — runs entirely in CI

---

## Security & Intent

This tool reads your HTML files, extracts Tailwind config blocks, builds a purged CSS file, and writes the result to `/assets/tailwind.css`.

**What this tool does NOT do:**
- No network requests
- No data collection  
- No execution of arbitrary code
- No external dependencies at runtime

The source is fully transparent — read it before you run it.


## License

>This Work is dual-licensed under the [APACHE2](LICENSE) and the
> Ethical Security Operations License [ESOL v1.1](ESOL).
> The ESOL is a mandatory, non-severable condition of use.
> By using this software, you agree to all ethical constraints defined in the ESOL v1.1.
>
> *by [VolkanSah](https://github.com/VolkanSah)* | [Source](https://github.com/VolkanSah/tailwindcss-extractor)
