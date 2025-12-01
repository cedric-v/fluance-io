## Fluance.io

Fluance.io is a multilingual (FR/EN) static website built with [Eleventy](https://www.11ty.dev/) and [Tailwind CSS](https://tailwindcss.com/).  
It is designed to be simple to develop locally, deploy on static hosting (GitHub Pages, Netlify, S3+CloudFront, etc.), and easy to maintain over time.

---

### Tech stack

- **Eleventy 3** as static site generator
- **Nunjucks** templates
- **Tailwind CSS 4** for styling
- **Node.js / npm** for tooling
- Optional: **Gemini API** helper script for content generation

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

Stop the dev server with `Ctrl + C`.

---

### Project structure

- `src/` – source content and templates
  - `_includes/` – base layout, header, footer
  - `fr/` – French content (e.g. `index.md`)
  - `index.njk` – root index, redirects to `/fr/`
  - `assets/css/styles.css` – Tailwind input CSS
- `_site/` – generated static site (ignored by git)
- `eleventy.config.js` – Eleventy configuration (i18n, filters, transforms)
- `tailwind.config.js` – Tailwind configuration
- `scripts/gemini-assist.js` – helper script to generate content using Gemini

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
  npx @tailwindcss/cli -i ./src/assets/css/styles.css -o ./_site/assets/css/styles.css --watch
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
  npx @tailwindcss/cli -i ./src/assets/css/styles.css -o ./_site/assets/css/styles.css --minify
  ```

- **`npm run ask-gemini "your prompt here"`**

  Uses the Gemini API to generate content (see “Using Gemini assistant” below).

---

### Building for production

Generate a production build (minified HTML, CSS, JS):

```bash
npm run build
```

Output:

- Static files are written to the `_site/` directory.
- This folder can be served by any static hosting provider (GitHub Pages, Netlify, S3, etc.).

In production, images can optionally be served from S3 if `S3_PUBLIC_URL` is set (see below).

---

### Deployment

You can deploy the content of `_site/` **as a static website**. Typical options:

#### Infomaniak (FTP + Object Storage S3)

Use the provided script to build and deploy in one command:

1. Create a `.env` file with your Infomaniak credentials:

```env
# FTP (web hosting)
FTP_HOST=your-ftp-host.infomaniak.com
FTP_USER=your-ftp-username
FTP_PASSWORD=your-ftp-password
FTP_REMOTE_DIR=/ # or /www, /web, etc. depending on your hosting
FTP_SECURE=false # or true if you use FTPS

# Object Storage (S3-compatible)
S3_ENDPOINT=https://s3.your-infomaniak-endpoint.com
S3_REGION=auto
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Public URL for images (base URL of your bucket)
S3_PUBLIC_URL=https://your-bucket-public-url
```

2. Run the deployment script:

```bash
npm run deploy:infomaniak
```

This will:

- Run a production build (`npm run build`) with `ELEVENTY_ENV=prod` and `S3_PUBLIC_URL`.
- Upload the contents of `_site/` to your Infomaniak hosting via FTP.
- Upload images from `src/assets/img/` to your Object Storage bucket under `assets/img/...`.

> Note: the `image` shortcode uses `S3_PUBLIC_URL` in production so that `<img>` tags in the generated HTML point directly to your Object Storage URLs.

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
        run: npm install

      - name: Build site
        env:
          ELEVENTY_ENV: prod
          # Optional: if you host images on S3
          # S3_PUBLIC_URL: https://your-bucket.s3.amazonaws.com
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

2. Deploy the contents of `_site/` to your static host (e.g. upload to S3, connect Netlify to the repo with build command `npm run build` and publish directory `_site`, etc.).

---

### Environment variables

This project uses environment variables for:

- **`ELEVENTY_ENV`**
  - `dev` for local development (`npm start`)
  - `prod` for production builds (`npm run build`)

- **`S3_PUBLIC_URL`** (optional)
  - Base URL for images in production, e.g. `https://your-bucket.s3.amazonaws.com`
  - Used by the `image` shortcode to generate `<img src="...">` tags.

- **`GEMINI_API_KEY`** (optional, for Gemini assistant script)
  - API key for Google Gemini, used by `scripts/gemini-assist.js`.
  - Must be stored in a local `.env` file (not committed) or in your CI/CD secrets.

Example `.env` (not committed to git):

```env
GEMINI_API_KEY=your-secret-key-here
S3_PUBLIC_URL=https://your-bucket.s3.amazonaws.com
```

---

### Using the Gemini assistant (optional)

The script `scripts/gemini-assist.js` helps generate content (Markdown, copy, etc.) with Gemini.

1. Create a `.env` file at the project root:

```env
GEMINI_API_KEY=your-gemini-api-key
```

2. Run the script with a prompt:

```bash
npm run ask-gemini "Write a French blog post outline about leadership in Markdown"
```

3. The output will be written to `gemini_output.md` and a preview will be printed in the terminal.

> Note: `gemini_output.md` is ignored by git.

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
  - Basic i18n is configured via `eleventy-plugin-i18n` in `eleventy.config.js`.
  - You can extend the `translations` object and add new languages as needed.

- **Static assets:**
  - Add images, icons, etc. under `src/assets/`.
  - They are copied to `_site/assets/` via `eleventyConfig.addPassthroughCopy`.

---

### Security and secrets

- No API keys or secrets are committed to the repository.
- Use `.env` files or CI/CD secret stores to keep:
  - `GEMINI_API_KEY`
  - `S3_PUBLIC_URL` (if needed)
- The `.gitignore` file excludes `.env` and other sensitive or generated files.


