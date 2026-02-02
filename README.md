## Fluance.io

Fluance.io is a multilingual (FR/EN) static website built with [Eleventy](https://www.11ty.dev/) and [Tailwind CSS](https://tailwindcss.com/).  
It is designed to be simple to develop locally, deploy on static hosting (GitHub Pages, Netlify, etc.), and easy to maintain over time.

---

### Tech stack

- **Eleventy 3** as static site generator
- **Nunjucks** templates
- **Tailwind CSS 4** for styling (CSS-first configuration)
- **Node.js / npm** for tooling

---

### Performance optimizations

The site includes several performance optimizations to ensure fast loading and smooth user experience:

#### Image optimization

- **WebP support with automatic fallback**: Images are automatically served in WebP format when available, with fallback to original formats (JPG/PNG) for compatibility
- **Explicit dimensions**: All images include `width` and `height` attributes to prevent Cumulative Layout Shift (CLS)
- **Lazy loading**: Images below the fold use `loading="lazy"` for faster initial page load
- **Eager loading for LCP**: Hero images and critical images use `loading="eager"` and `fetchpriority="high"` for optimal Largest Contentful Paint (LCP)
- **Responsive positioning**: Hero images use responsive `object-position` (centered on mobile, right-aligned on desktop)

#### Navigation optimization

- **Link prefetching**: Menu links are prefetched on hover (with 100ms delay) to accelerate page transitions
- **Smooth transitions**: CSS transitions reduce visual flicker during navigation
- **Optimized event listeners**: Uses `passive: true` for better scroll performance

#### Font loading

- **Preconnect**: Early connection to Google Fonts and external resources
- **Preload**: Critical Inter font is preloaded for faster rendering
- **Font-display**: Uses `font-display: optional` to prevent layout shifts

#### CSS and resource loading

- **CSS preload**: Critical CSS is preloaded asynchronously
- **Minification**: Production builds include minified HTML, CSS, and JavaScript
- **Will-change optimization**: Applied only during active transitions to avoid unnecessary layer creation

#### Core Web Vitals

The site is optimized for Google's Core Web Vitals:
- **LCP (Largest Contentful Paint)**: Optimized with eager loading and preconnect hints
- **FID/INP (First Input Delay / Interaction to Next Paint)**: Reduced with passive event listeners and optimized JavaScript
- **CLS (Cumulative Layout Shift)**: Minimized with explicit image dimensions and stable font loading

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
  - `robots.txt` – robots.txt file (copied to root)
  - `llms.txt` – LLM-friendly site description (copied to root)
  - `assets/css/styles.css` – Tailwind input CSS
- `_site/` – generated static site (ignored by git)
  - `sitemap.xml` – automatically generated sitemap
  - `robots.txt` – copied from src/
  - `llms.txt` – copied from src/
- `eleventy.config.js` – Eleventy configuration (i18n, filters, transforms, shortcodes)
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

### Quality assurance and validation

The project includes automated quality checks to ensure the site works correctly:

#### Automated smoke tests

**Smoke tests** run automatically after each build to validate that critical pages are accessible and render correctly. The testing process includes multiple validation stages:

**Stage 1: Build artifact verification**
- ✅ Verify that critical files are present in the build output (`_site/`)
- ✅ Check for required files: `index.html`, `fr/index.html`, `en/index.html`, `CNAME`, `.nojekyll`, `404.html`
- ✅ Verify artifact statistics (HTML file count, total size)

**Stage 2: Artifact download verification**
- ✅ Verify that the downloaded artifact contains all critical files
- ✅ Check file sizes to ensure files were not corrupted during download
- ✅ Validate artifact integrity

**Stage 3: Local smoke tests**
- ✅ Verify that critical pages return HTTP 200 status
- ✅ Check that pages contain valid HTML content (title and body tags)
- ✅ Verify CNAME file content (must be `fluance.io`)
- ✅ Verify `.nojekyll` file presence (disables Jekyll processing)
- ✅ Test custom 404 page handling
- ✅ **Block deployment** if any critical page fails

**Stage 4: Deployment verification**
- ✅ Verify deployment status and page URL generation
- ✅ Confirm successful deployment to GitHub Pages

**Stage 5: Production accessibility tests (post-deploy)**
- ✅ Wait for GitHub Pages propagation (30 seconds)
- ✅ Test critical pages on production URL (`https://fluance.io`)
- ✅ Verify production site accessibility and HTML validity
- ⚠️ Note: Some tests may fail during initial propagation (can take up to 10 minutes)

**Pages tested:**
- Homepage (root, FR, EN)
- Contact page
- Login page (`/connexion-membre/`)
- Online course pages (5 days, 21 days)
- Member area (`/membre/`)
- Custom 404 page (`/404.html`)
- 404 error handling (non-existent page)

**When smoke tests run:**
- Automatically after each build on push to `main`
- Before deployment (deployment is blocked if tests fail)
- After deployment (production accessibility tests)

**Viewing test results:**
1. Go to the **Actions** tab in GitHub
2. Click on the latest workflow run
3. View test results in:
   - **"build"** job: Artifact verification
   - **"smoke-test"** job: Local smoke tests
   - **"deploy"** job: Deployment status
   - **"post-deploy"** job: Production accessibility tests

#### Optional validation reports

The project also includes optional quality checks using **Google Lighthouse** and **W3C HTML Validator**. These reports are **not generated automatically** and can be triggered manually when needed (see [GENERER_RAPPORTS_VALIDATION.md](GENERER_RAPPORTS_VALIDATION.md) for instructions).

#### Generating validation reports

Validation reports are **not generated automatically** by default. To generate them:

1. Go to **Actions** tab in GitHub
2. Select **"Deploy site to GitHub Pages"** workflow
3. Click **"Run workflow"**
4. **Check the box** "Exécuter les rapports Lighthouse et W3C"
5. Click **"Run workflow"**

See [GENERER_RAPPORTS_VALIDATION.md](GENERER_RAPPORTS_VALIDATION.md) for detailed instructions.

#### Accessing the reports

After running the workflow with validation enabled, reports are uploaded as GitHub Actions artifacts:

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

- **Automatic dependency security monitoring:**

  The project uses **GitHub Dependabot** to automatically monitor dependencies for security vulnerabilities and version updates.

  - **Security alerts**: Dependabot automatically scans dependencies and creates pull requests for security updates
  - **Version updates**: Weekly checks for new versions of dependencies (minor and patch updates)
  - **Configuration**: See `.github/dependabot.yml` for monitoring settings
  - **Notifications**: You'll receive GitHub notifications and emails for:
    - Security vulnerabilities (high priority)
    - Available dependency updates (weekly summary)
  - **Pull requests**: Dependabot creates PRs automatically with:
    - Changelog information
    - Labels: `dependencies`, `npm`, `functions`
    - Grouped updates for minor/patch versions

  **How to use Dependabot PRs:**
  1. Review the PR description and changelog
  2. Test locally if needed: `git checkout <dependabot-branch> && npm install && npm test`
  3. Merge the PR if everything looks good
  4. Dependabot will automatically update `package-lock.json` and `package.json`

  **Manual dependency checks:**

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

- **Open Graph (OG) Tags:**
  - Open Graph meta tags are automatically generated for all pages to optimize social media sharing (Facebook, Twitter, LinkedIn, etc.).
  - All OG tags are included in the base template (`src/_includes/base.njk`).
  - **Default description**: If a page doesn't have a `description` in its frontmatter, it uses:
    - **FR**: "Fluance : le mouvement qui éveille et apaise. Libérez votre corps des tensions grâce à une approche simple basée sur le mouvement, le souffle et le jeu."
    - **EN**: "Fluance: the movement that awakens and soothes. Release tension from your body through a simple approach based on movement, breath and play."
  - **Custom OG image**: To use a specific image for social media sharing, add `ogImage` to the page frontmatter:
    ```yaml
    ---
    layout: base.njk
    title: My Page
    description: My page description
    ogImage: assets/img/my-hero-image.jpg
    ---
    ```
  - **Default OG image**: If `ogImage` is not specified, the default image `assets/img/fond-cedric.jpg` (homepage hero image) is used.
  - **OG tags included**:
    - `og:type` - Always set to "website"
    - `og:url` - Canonical URL of the page
    - `og:title` - Page title + "| Fluance"
    - `og:description` - Page description (or default)
    - `og:image` - Full URL to the OG image (1200x630 recommended)
    - `og:image:width` and `og:image:height` - Image dimensions
    - `og:locale` - Language locale (fr_FR or en_US)
    - `og:locale:alternate` - Alternate language version
    - `og:site_name` - "Fluance"
  - **Twitter Card tags** are also included for optimal Twitter sharing:
    - `twitter:card` - Set to "summary_large_image"
    - `twitter:url`, `twitter:title`, `twitter:description`, `twitter:image`
  - **Image URL generation**: The `buildOgImageUrl` filter automatically converts relative image paths to full URLs (`https://fluance.io/...`).
  - **Testing**: Use Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) or Twitter's [Card Validator](https://cards-dev.twitter.com/validator) to preview how your pages appear when shared.

- **Schema.org JSON-LD:**
  - Structured data markup is automatically generated for all pages to improve SEO and enable rich results in search engines.
  - The `schemaOrg` shortcode in `eleventy.config.js` generates appropriate schemas based on page type.
  - **Schemas included:**
    - **Organization** (all pages): Information about Fluance / Instants Zen Sàrl, address, contact, social media
    - **WebSite** (all pages): Site information with SearchAction for search functionality
    - **Person** (all pages): Information about Cédric Vonlanthen (founder/instructor)
    - **Service** (homepage only): Description of wellness services and offers
    - **Course** (online course pages): Course information, pricing, descriptions, languages
    - **LocalBusiness** (in-person class pages): Information about classes in Fribourg, address, coordinates, pricing
  - **Multilingual support**: Schemas automatically adapt to page language (FR/EN).
  - **Security**: Email is not included in schemas to prevent spam scraping (phone number is used instead).
  - **Validation**: Test your structured data with Google's [Rich Results Test](https://search.google.com/test/rich-results).
  - Schemas are included in the `<head>` of every page via `src/_includes/base.njk`.

- **llms.txt:**
  - A structured file (`llms.txt`) is available at the root of the site to help Large Language Models (LLMs) better understand and reference the site.
  - **Purpose**: Improves how AI assistants (ChatGPT, Claude, Perplexity, etc.) understand and recommend Fluance in their responses.
  - **Content**: Includes site description, main sections with links, services, pricing, contact information, and approach characteristics.
  - **Location**: The file is located at `src/llms.txt` and is automatically copied to the site root during build.
  - **Access**: Available at `https://fluance.io/llms.txt` after deployment.
  - **Focus**: Content-oriented information for users, without technical implementation details.

- **Static assets:**
  - Add images, icons, etc. under `src/assets/img/`.
  - They are copied to `_site/assets/img/` via `eleventyConfig.addPassthroughCopy`.
  - **WebP optimization**: For better performance, convert images to WebP format and place them alongside the original files (e.g., `image.jpg` and `image.webp`). The `image` shortcode automatically serves WebP when available, with fallback to the original format.
  - **Image shortcode usage**: Use `{% image "assets/img/filename.jpg", "alt text", "classes", "loading", "fetchpriority", "width", "height" %}` in templates. Always provide width and height to prevent layout shifts.

---

### Security and secrets
 
 - **Dependency security**: Automated monitoring via GitHub Dependabot (see [Maintenance](#maintenance) section)
 - **Secrets management**: No API keys or secrets are committed to the repository.
 - **Frontend Environment variables**: The site uses environment variables for Firebase and Stripe configuration. These are loaded from a local `.env` file during development and from **GitHub Repository Secrets** during deployment.
 - **Backend Environment variables**: Firebase Functions use environment variables configured via the Firebase Console (see `CONFIGURATION_VARIABLES_ENV.md`).
 - **Git ignore**: The `.gitignore` file correctly excludes `.env` and other sensitive files.
 - **Security alerts**: Check the **Security** tab in GitHub for active security advisories.
