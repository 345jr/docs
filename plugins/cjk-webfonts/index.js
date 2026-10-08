// @ts-check
/**
 * 把中文字体的 webfont 资源复制到 build/assets/fonts/ 下，供 FontPicker 按需注入。
 *
 * 为什么不直接 `import 'xxx/result.css'`：
 *   1. Docusaurus 3.10 开启了 `future.v4`，默认走 rspack（fasterByDefault），
 *      所有 CSS 都会被合进全局 styles.css，动态 import 也拆不出独立 chunk；
 *   2. 这些字体的 @font-face 动辄上百条、几十 KB 到上百 KB(gzip)，
 *      塞进全局样式表意味着「即使用户一直用系统默认字体」也要为它买单，
 *      而且它是渲染阻塞资源。
 *
 * 所以这里走 CopyPlugin：产物落在 `assets/fonts/<字体>/<版本>/<字重>/`，
 * 版本号进路径、文件名稳定，适合远端 nginx 配 immutable 长缓存；
 * FontPicker 只在用户真正选中该字体时才注入对应的 <link>。
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * 每个字体只需登记「正文 + 标题」两个字重，其余一律不拷（避免部署体积翻倍）。
 *
 * - lxgw（霞鹜文楷）：Regular 作正文。霞鹜文楷没有 Bold，标题交给同包的
 *   Medium —— 它的 CSS 里 family 名是 'LXGW WenKai Medium' 而非 'LXGW WenKai'，
 *   是两个独立 family，所以 FontPicker 那边要用 --site-emphasis-font 切过去。
 * - notoSerif（思源宋体）：Regular + Bold 属于同一个 family 'Noto Serif SC'，
 *   标题直接吃 font-weight: 700 就能命中真 Bold，不需要任何额外变量。
 */
const FONTS = [
  {
    key: 'lxgw',
    pkg: '@callmebill/lxgw-wenkai-web',
    /** 包内有 VERSION 文件（形如 v1.522），比 package.json 更贴近字体本体版本 */
    versionFile: 'VERSION',
    weights: [
      {dir: 'lxgwwenkai-regular', out: 'regular', css: 'result.css'},
      {dir: 'lxgwwenkai-medium', out: 'medium', css: 'result.css'},
    ],
    ignore: ['**/index.html', '**/reporter.json', '**/result.min.css'],
  },
  {
    key: 'notoSerif',
    pkg: 'noto-serif-sc',
    /** 没有 VERSION 文件，退回用包版本号（随内容变化即可满足缓存失效） */
    weights: [
      {dir: 'noto_serif_sc_regular', out: 'regular', css: 'css.css'},
      {dir: 'noto_serif_sc_bold', out: 'bold', css: 'css.css'},
    ],
    ignore: [],
  },
];

function resolvePkgRoot(siteDir, pkg) {
  return path.dirname(require.resolve(`${pkg}/package.json`, {paths: [siteDir]}));
}

function readVersion(pkgRoot, font) {
  if (font.versionFile) {
    return fs
      .readFileSync(path.join(pkgRoot, font.versionFile), 'utf8')
      .trim()
      .replace(/^v/, '');
  }
  return JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'))
    .version;
}

module.exports = function cjkWebfontsPlugin(context) {
  // 预解析：产物路径要写进 globalData，给前端拼 <link> 的 href，
  // 否则「哪个包里CSS 文件叫什么名字」这种细节就得在前端也硬编码一遍。
  const fonts = FONTS.map((font) => {
    const pkgRoot = resolvePkgRoot(context.siteDir, font.pkg);
    const version = readVersion(pkgRoot, font);
    const baseDir = `assets/fonts/${font.key}/${version}`;
    return {
      key: font.key,
      pkgRoot,
      ignore: font.ignore,
      version,
      baseDir,
      weights: font.weights,
      // 相对 baseUrl 的路径，不带前导斜杠，交给前端 useBaseUrl 处理
      stylesheets: font.weights.map(
        ({out, css}) => `${baseDir}/${out}/${css}`,
      ),
    };
  });

  return {
    name: 'cjk-webfonts',

    async loadContent() {
      // 只需暴露路径，pkgRoot 之类的别泄进客户端 bundle
      return Object.fromEntries(
        fonts.map(({key, version, baseDir, stylesheets}) => [
          key,
          {version, baseDir, stylesheets},
        ]),
      );
    },

    async contentLoaded({content, actions}) {
      // 交给客户端组件用 usePluginData('cjk-webfonts') 拼出 <link> 的 href，
      // 避免在前端硬编码版本号。
      actions.setGlobalData(content);
    },

    // 注意：configureWebpack 必须是同步的 —— Docusaurus 的 applyConfigureWebpack
    // 直接把返回值当 webpack config 用，不会 await。写成 async 会被静默丢弃。
    configureWebpack(config, isServer, {currentBundler}) {
      // SSR 产物用不到字体，字体只对浏览器有意义
      if (isServer) {
        return {};
      }

      // @docusaurus/bundler 的 getCopyPlugin 是 async，这里拿不到；
      // currentBundler 是已解析好的，直接按名字取对应的插件类。
      const CopyPlugin =
        currentBundler.name === 'rspack'
          ? currentBundler.instance.CopyRspackPlugin
          : require('copy-webpack-plugin');

      const patterns = fonts.flatMap((font) =>
        font.weights.map(({dir, out}) => ({
          // 整目录拷：css 里的 url("./xxx.woff2") 相对于它自己解析，
          // 同一目录下的分片正好接得住。注意 rspack 的 CopyRspackPlugin
          // 不支持在 from 里写 glob，只能这样整目录拷再用 globOptions 排除。
          from: path.join(font.pkgRoot, dir),
          to: `${font.baseDir}/${out}`,
          toType: 'dir',
          globOptions: font.ignore.length ? {ignore: font.ignore} : undefined,
          info: {minimized: true},
        })),
      );

      return {plugins: [new CopyPlugin({patterns})]};
    },
  };
};