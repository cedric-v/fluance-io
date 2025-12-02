## Fluance.io

Fluance.io is a multilingual (FR/EN) static website built with [Eleventy](https://www.11ty.dev/) and [Tailwind CSS](https://tailwindcss.com/).  
It is designed to be simple to develop locally, deploy on static hosting (GitHub Pages, Netlify, etc.), and easy to maintain over time.

---

### Tech stack

- **Eleventy 3** as static site generator
- **Nunjucks** templates
- **Tailwind CSS 3** for styling
- **Node.js / npm** for tooling

---

### Prerequisites

- **Node.js** (recommended: latest LTS)
- **npm** (comes with Node)
- A **GitHub** account (for deployment with GitHub Pages or CI)

---

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/cedric-v/fluance-io.git
cd fluance-io
npm install
```

---

### Local development

Start the Eleventy dev server and Tailwind watcher:

```bash
npm start
```

This will:

- Run Eleventy in dev mode with live reload at `http://localhost:8080/`
- Build Tailwind CSS from `src/assets/css/styles.css` to `_site/assets/css/styles.css` in watch mode

The main pages are:

- Root (redirects to FR): `http://localhost:8080/`
- French homepage: `http://localhost:8080/fr/`
- English homepage: `http://localhost:8080/en/`

Stop the dev server with `Ctrl + C`.

---

### Project structure

- `src/` – source content and templates
  - `_includes/` – base layout, header, footer
  - `fr/` – French content (e.g. `index.md`, `a-propos/philosophie.md`)
  - `en/` – English content (e.g. `index.md`)
  - `index.njk` – root index, redirects to `/fr/`
  - `sitemap.njk` – sitemap.xml generator template
  - `assets/css/styles.css` – Tailwind input CSS
- `_site/` – generated static site (ignored by git)
  - `sitemap.xml` – automatically generated sitemap
- `eleventy.config.js` – Eleventy configuration (i18n, filters, transforms)
- `tailwind.config.js` – Tailwind configuration

---

### Available npm scripts

From `package.json`:

- **`npm start`**

  Runs both dev servers:

  ```bash
  npm-run-all --parallel dev:*
  ```

- **`npm run dev:11ty`**

  Eleventy dev server with live reload:

  ```bash
  cross-env ELEVENTY_ENV=dev eleventy --serve
  ```

- **`npm run dev:css`**

  Tailwind CSS in watch mode:

  ```bash
  npx tailwindcss -i ./src/assets/css/styles.css -o ./_site/assets/css/styles.css --watch
  ```

- **`npm run build`**

  Production build for deployment:

  ```bash
  cross-env ELEVENTY_ENV=prod npm-run-all build:css build:11ty
  ```

- **`npm run build:11ty`**

  ```bash
  eleventy
  ```

- **`npm run build:css`**

  ```bash
  npx tailwindcss -i ./src/assets/css/styles.css -o ./_site/assets/css/styles.css --minify
  ```

---

### Building for production

Generate a production build (minified HTML, CSS, JS):

```bash
npm run build
```

Output:

- Static files are written to the `_site/` directory.
- This folder can be served by any static hosting provider (GitHub Pages, Netlify, S3, etc.).

---

### Deployment

You can deploy the content of `_site/` **as a static website**. The project is configured to use **GitHub Pages** via GitHub Actions.

#### GitHub Pages (via GitHub Actions)

Recommended: automatically build and deploy the site on each push to `main` using GitHub Actions.

1. In your repo, create the directory `.github/workflows/` (if it does not exist).
2. Add a file `.github/workflows/deploy.yml` with this content:

```yaml
name: Deploy site to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'

      - name: Install dependencies
        run: npm ci

      - name: Build site
        env:
          ELEVENTY_ENV: prod
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

3. In GitHub → **Settings → Pages**:
   - Set **Source** to “GitHub Actions”.

On each push to `main`, GitHub will:

- Install dependencies
- Run `npm run build`
- Deploy the `_site/` folder to GitHub Pages.

#### Manual or other hosts (Netlify, S3, etc.)

1. Build the site:

   ```bash
   npm run build
   ```

2. Deploy the contents of `_site/` to your static host (e.g. connect Netlify to the repo with build command `npm run build` and publish directory `_site`, etc.).

---

### Quality assurance and validation reports

The project includes automated quality checks using **Google Lighthouse** and **W3C HTML Validator**. These reports are generated automatically on each deployment via GitHub Actions.

#### Accessing the reports

After each deployment, validation reports are generated and uploaded as GitHub Actions artifacts:

1. Go to your repository on GitHub
2. Click on the **"Actions"** tab
3. Click on the latest workflow run **"Deploy site to GitHub Pages"**
4. Click on the **"validate"** job
5. Scroll down to the **"Artifacts"** section at the bottom of the page
6. Click on **"validation-reports"** to download the ZIP file
7. Extract the ZIP file to access the reports

**Note:** Artifacts are retained for 30 days. After this period, they are automatically deleted.

#### Report contents

The `validation-reports` artifact contains:

**Google Lighthouse reports:**
- `lighthouse-home.html` - Full Lighthouse report for the homepage (HTML format)
- `lighthouse-fr.html` - Full Lighthouse report for the French homepage (HTML format)
- `lighthouse-en.html` - Full Lighthouse report for the English homepage (HTML format, if available)
- `lighthouse-home.json` - Lighthouse data for the homepage (JSON format)
- `lighthouse-fr.json` - Lighthouse data for the French homepage (JSON format)

**W3C HTML Validation reports:**
- `w3c/` directory containing validation reports for up to 10 HTML pages
  - Each page has both HTML and JSON format reports
  - Files are named based on the page path (e.g., `index.html`, `fr_index.html`, `a-propos_philosophie_index.html`)

**Summary:**
- `summary.md` - Overview of available reports and how to use them

#### Using the reports

**Lighthouse reports:**
- Open the HTML files in your browser for a visual, interactive report
- Lighthouse evaluates:
  - **Performance** - Page load speed and optimization
  - **Accessibility** - WCAG compliance and screen reader support
  - **Best Practices** - Security, modern web standards
  - **SEO** - Search engine optimization
- Use the JSON files for programmatic analysis or integration with CI/CD tools
- Aim for scores above 90 in each category for optimal results

**W3C Validation reports:**
- Open the HTML reports to see detailed validation errors and warnings
- The JSON format is useful for automated parsing and error detection
- Fix any errors (marked in red) and review warnings (marked in yellow)
- Valid HTML ensures better browser compatibility and accessibility

#### Troubleshooting

If you don't see the "Artifacts" section:
- Wait a few seconds after the workflow completes (upload may take time)
- Refresh the page
- Check the "Upload validation reports" step logs to verify the upload succeeded
- Ensure the "validate" job completed (it may show warnings but should still generate reports)

If W3C reports are missing:
- Check the workflow logs for the "Validate HTML with W3C" step
- The reports use the local server URLs, so ensure the server started successfully
- Some validation errors won't prevent report generation

---

### Environment variables

This project uses environment variables for:

- **`ELEVENTY_ENV`**
  - `dev` for local development (`npm start`)
  - `prod` for production builds (`npm run build`)

---

### Maintenance

To keep the project healthy over time:

- **Update dependencies periodically:**

  ```bash
  npm outdated   # see what is out of date
  npm update     # safe minor/patch updates
  ```

- **Rebuild Tailwind and Eleventy after changes:**

  - For dev: `npm start`
  - For prod: `npm run build`

- **Add new content:**
  - French pages under `src/fr/` (Markdown or Nunjucks).
  - Shared layouts/partials under `src/_includes/`.

- **Internationalization (i18n):**
  - The site supports **French (FR)** and **English (EN)** languages.
  - Basic i18n is configured via `eleventy-plugin-i18n` in `eleventy.config.js`.
  - French content is located in `src/fr/`, English content in `src/en/`.
  - Language switching is handled in the header navigation.
  - Each page includes `hreflang` tags for proper SEO and language targeting.
  - You can extend the `translations` object and add new languages as needed.

- **Sitemap:**
  - A `sitemap.xml` is automatically generated during the build process.
  - The sitemap includes all pages (excluding JSON files and 404 pages).
  - Pages are prioritized: homepage (1.0), "À propos" pages (0.8), others (0.6).
  - Multilingual pages include `hreflang` tags for proper language targeting.
  - The sitemap is accessible at `https://fluance.io/sitemap.xml` after deployment.
  - You can submit it to Google Search Console for better indexing.

- **Static assets:**
  - Add images, icons, etc. under `src/assets/`.
  - They are copied to `_site/assets/` via `eleventyConfig.addPassthroughCopy`.

---

### Security and secrets

- No API keys or secrets are committed to the repository.
- Use `.env` files or CI/CD secret stores (GitHub Actions secrets) if you add external APIs later.
- The `.gitignore` file excludes `.env` and other sensitive or generated files.


