Easy to use Put your htmls files in /docs folder. than start actions.

```
tailwindcss-extractor/
├── .github/
│   ├── workflows/
│   │   └── extract-tailwind.yml   ← Action
│   └── scripts/
│       └── extract-tailwind.js    ← Worker Script
├── docs/
│   └── *.html                     ← HTML-Data
├── assets/
│   └── tailwind.css               ← auto-gen
├── package.json
└── .gitignore
```
