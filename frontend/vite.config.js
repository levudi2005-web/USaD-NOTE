import { readdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import banner from "./vite/banner.js";
import beautifyHtml from "./vite/beautify-html.js";
import classicScript from "./vite/classic-script.js";
import handlebarsPages from "./vite/handlebars-pages.js";
import data from "./src/data/index.js";
import * as helpers from "./src/helpers/index.js";

const src = (path) => resolve(import.meta.dirname, "src", path);

const pages = Object.fromEntries(
  readdirSync(src("pages"))
    .filter((file) => extname(file) === ".html")
    .map((file) => [basename(file, ".html"), src(`pages/${file}`)])
);

const bundles = {
  app: src("js/app.js"),
  "share-viewer": src("js/share.js"),
  head: src("js/head.js"),
};

for (const name of Object.keys(bundles)) {
  if (name in pages) {
    throw new Error(`src/pages/${name}.html clashes with the ${name} bundle`);
  }
}

const assetDirectories = {
  ".woff": "fonts",
  ".woff2": "fonts",
  ".ttf": "fonts",
  ".eot": "fonts",
  ".svg": "img",
  ".png": "img",
  ".jpg": "img",
  ".jpeg": "img",
  ".gif": "img",
};

// The stylesheet keeps its name (NOTE pages reference css/app.css);
// fonts and images from different packages can share a basename, so they are hashed
const assetFileName = ({ names: [name] }) => {
  const extension = extname(name);
  if (extension === ".css") {
    return "css/[name][extname]";
  }
  return `${assetDirectories[extension] ?? "assets"}/[name]-[hash][extname]`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    root: src("pages"),
    publicDir: resolve(import.meta.dirname, "public"),
    base: "./",
    plugins: [
      {
        name: "note-share-absolute-assets",
        transformIndexHtml: {
          order: "post",
          handler(html) {
            if (!html.includes("data-public-share")) return html;
            return html
              .replaceAll('src="./img/', 'src="/img/')
              .replaceAll('href="./img/', 'href="/img/')
              .replaceAll('src="./js/', 'src="/js/')
              .replaceAll('href="./css/', 'href="/css/');
          },
        },
      },
      {
        name: "note-share-route",
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            const pathname = new URL(request.url ?? "/", "http://localhost")
              .pathname;
            if (pathname === "/share" || pathname === "/share/") {
              request.url = request.url.replace(pathname, "/share.html");
            }
            next();
          });
        },
      },
      handlebarsPages({
        data,
        helpers: { ...helpers },
        layoutDirectory: src("layouts"),
        partialDirectory: [src("partials")],
        compileOptions: { preventIndent: true },
      }),
      beautifyHtml(),
      banner(
        "css/app.css",
        `/*!
 * NOTE Workspace v${data.version}
 * Contains AdminKit code Copyright (c) 2020-2024 AdminKit Authors
 * Licensed under MIT; see LICENSE
 */`
      ),
      classicScript(Object.keys(bundles), ["app", "share-viewer"]),
    ],
    resolve: {
      // Pages live in src/pages, so the dev server cannot reach ../js and ../scss by relative URL.
      // Templates use the output paths (/js/app.js, /css/app.css) and these map them to the sources.
      alias: [
        { find: /^\/js\//, replacement: `${src("js")}/` },
        { find: /^\/css\/app\.css/, replacement: src("scss/app.scss") },
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Our own SCSS only triggers "import"; the rest comes from Bootstrap 5.3
          silenceDeprecations: [
            // @import: Bootstrap 5.3 has no @use entry point, so the whole tree still uses it
            "import",
            // red(), green(), blue() in Bootstrap's color-contrast()
            "color-functions",
            // mix(), map-get() and friends without a sass: module prefix in Bootstrap
            "global-builtin",
            // Sass if() in Bootstrap's mixins
            "if-function",
          ],
        },
      },
    },
    build: {
      outDir: resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      assetsInlineLimit: 0,
      modulePreload: { polyfill: false },
      rolldownOptions: {
        input: { ...pages, ...bundles },
        output: {
          entryFileNames: "js/[name].js",
          chunkFileNames: "js/[name]-[hash].js",
          assetFileNames: assetFileName,
        },
      },
    },
    server: {
      port: 8080,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          timeout: 30_000,
          proxyTimeout: 30_000,
          configure(proxy) {
            proxy.on("error", (error, request, response) => {
              console.error(
                `[api-proxy] ${request.method} ${request.url}: ${error.message}`
              );
              if (response.headersSent) return;
              response.writeHead(502, { "Content-Type": "application/json" });
              response.end(
                JSON.stringify({
                  detail:
                    "Không kết nối được tới FastAPI. Hãy kiểm tra backend và VITE_API_PROXY_TARGET.",
                })
              );
            });
          },
        },
      },
    },
  };
});
