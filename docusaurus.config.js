// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';
import fs from 'node:fs';
import path from 'node:path';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Lopop Docs',
  tagline: '文档站点',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.lopop.top',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: '345jr', // Usually your GitHub org/user name.
  projectName: 'docs', // Usually your repo name.

  onBrokenLinks: 'throw',

  // 私有文档阅读页：src/pages/private.tsx 只注册 /private，
  // 这里的内联插件补上展开路由 /private/*（/private/<分类>/<文档>），
  // 使侧边栏 active 判定与文档站行为一致。
  plugins: [
    require.resolve('./plugins/cjk-webfonts'),
    function privateDocsRoutes() {
      return {
        name: 'private-docs-routes',
        contentLoaded({actions}) {
          actions.addRoute({
            path: '/private/*',
            component: '@site/src/pages/private.tsx',
            exact: true,
          });
        },
        postBuild({outDir}) {
          // SSG 会为 splat 路由多生成一个字面量 build/private/*/index.html，删掉它
          fs.rmSync(path.join(outDir, 'private', '*'), {recursive: true, force: true});
        },
      };
    },
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/345jr/docs/tree/main/',
        },
        blog: false,
        sitemap: {
          ignorePatterns: ['/private', '/private/**'],
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      navbar: {
        title: 'Lopop Docs',
        logo: {
          alt: 'Lopop Docs Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: '文档',
          },
          {
            to: '/private',
            position: 'left',
            label: '私有文档',
          },
          {
            to: '/editor',
            position: 'left',
            label: '在线编辑',
          },
          {
            type: 'custom-fontPicker',
            position: 'right',
          },
          {
            href: 'https://github.com/345jr/docs',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
