import { sentryVitePlugin } from '@sentry/vite-plugin'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import packageJson from './release/app/package.json'

dotenv.config()

const inferredRelease = process.env.SENTRY_RELEASE || packageJson.version

function injectBaseTag(): Plugin {
  return {
    name: 'inject-base-tag',
    transformIndexHtml() {
      return [{ tag: 'base', attrs: { href: '/' }, injectTo: 'head-prepend' }]
    },
  }
}

function injectReleaseDate(): Plugin {
  const releaseDate = new Date().toISOString().slice(0, 10)
  return {
    name: 'inject-release-date',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.chatbox_release_date="${releaseDate}";`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

function replacePlausibleDomain(): Plugin {
  return {
    name: 'replace-plausible-domain',
    transformIndexHtml(html) {
      return html.replace('data-domain="app.chatboxai.app"', 'data-domain="web.chatboxai.app"')
    },
  }
}

function dvhToVh(): Plugin {
  return {
    name: 'dvh-to-vh',
    transform(code, id) {
      if (id.endsWith('.css') || id.endsWith('.scss') || id.endsWith('.sass')) {
        return { code: code.replace(/(\d+)dvh/g, '$1vh'), map: null }
      }
      return null
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: path.resolve(__dirname, 'src/renderer/routes'),
      generatedRouteTree: path.resolve(__dirname, 'src/renderer/routeTree.gen.ts'),
    }),
    react({}),
    dvhToVh(),
    injectBaseTag(),
    injectReleaseDate(),
    replacePlausibleDomain(),
    visualizer({
      filename: 'release/app/dist/renderer/stats.html',
      open: false,
      title: 'Renderer Process Dependency Analysis',
    }),
    process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          authToken: process.env.SENTRY_AUTH_TOKEN,
          org: 'sentry',
          project: 'chatbox',
          url: 'https://sentry.midway.run/',
          release: { name: inferredRelease },
          sourcemaps: { assets: 'release/app/dist/renderer/**' },
          telemetry: false,
        })
      : undefined,
  ].filter(Boolean) as Plugin[],
  build: {
    outDir: path.resolve(__dirname, 'release/app/dist/renderer'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: 'hidden',
    minify: 'esbuild',
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/index.html'),
      output: {
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'styles/[name].[hash][extname]'
          if (/\.(woff|woff2|eot|ttf|otf)$/i.test(assetInfo.name || '')) return 'fonts/[name].[hash][extname]'
          if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) return 'images/[name].[hash][extname]'
          return 'assets/[name].[hash][extname]'
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@ai-sdk') || id.includes('ai/')) return 'vendor-ai'
            if (id.includes('@mantine') || id.includes('@tabler')) return 'vendor-ui'
            if (id.includes('mermaid') || id.includes('d3')) return 'vendor-charts'
          }
        },
      },
    },
  },
  css: {
    modules: { generateScopedName: '[name]__[local]___[hash:base64:5]' },
    postcss: path.resolve(__dirname, 'postcss.config.cjs'),
  },
  define: {
    'process.type': '"renderer"',
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.CHATBOX_BUILD_TARGET': JSON.stringify(process.env.CHATBOX_BUILD_TARGET || 'unknown'),
    'process.env.CHATBOX_BUILD_PLATFORM': JSON.stringify('web'),
    'process.env.CHATBOX_BUILD_CHANNEL': JSON.stringify(process.env.CHATBOX_BUILD_CHANNEL || 'unknown'),
    'process.env.USE_LOCAL_API': JSON.stringify(process.env.USE_LOCAL_API || ''),
    'process.env.USE_BETA_API': JSON.stringify(process.env.USE_BETA_API || ''),
    'process.env.GPT_API_KEY': JSON.stringify(process.env.GPT_API_KEY || ''),
  },
  optimizeDeps: {
    include: ['mermaid'],
    esbuildOptions: { target: 'es2015' },
  },
})
