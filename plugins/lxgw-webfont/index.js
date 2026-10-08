// @ts-check
/**
 * 把「霞鹜文楷」webfont 复制到 build/assets/fonts/ 下，并按需（用户选中该字体时）
 * 以 `<link>` 注入其 CSS。
 *
 * 为什么不直接 `import '@callmebill/lxgw-wenkai-web/lxgwwenkai-regular/result.css'`：
 *   1. Docusaurus 3.10 开启了 `future.v4`，默认走 rspack（fasterByDefault），
 *      所有 CSS 都会被合进全局 styles.css，动态 import 也拆不出独立 chunk；
 *   2. 霞鹜文楷两个字重的 @font-face 有 448 条、约 130KB(gzip)，
 *      塞进全局样式表意味着「即使用户一直用系统默认字体」也要为它买单，
 *      而且它是渲染阻塞资源。
 *
 * 所以这里走 CopyPlugin：产物落在 `assets/fonts/lxgw-wenkai/<版本>/<字重>/`，
 * 版本号进路径，文件名稳定，适合远端 nginx 配 immutable 长缓存；
 * FontPicker 只在用户真正选中该字体时才注入对应的 <link>。
 *
 * 只复制正文用得到的两个字重，不引包根目录的 style.css（它 @import 了
 * Light/Medium/Regular + 三个等宽 Mono，共 6 份、多一倍体积）。
 */

const fs = require('node:fs');
const path = require('node:path');

const PKG = '@callmebill/lxgw-wenkai-web';

/** Regular 作正文，Medium 作标题/行内加粗（见 custom.css 的 --site-emphasis-font） */
const WEIGHTS = [
  {dir: 'lxgwwenkai-regular', out: 'regular'},
  {dir: 'lxgwwenkai-medium', out: 'medium'},
];

/** 去掉包里跟 webfont 无关的构建中间产物（预览页 / 分片报告 / 另一份压缩 CSS） */
const IGNORED = ['**/index.html', '**/reporter.json', '**/result.min.css'];

function resolvePkgRoot(siteDir) {
  return path.dirname(
    require.resolve(`${PKG}/package.json`, {paths: [siteDir]}),
  );
}

module.exports = function lxgwWebfontPlugin(context) {
  const pkgRoot = resolvePkgRoot(context.siteDir);
  // 包里的 VERSION 形如 "v1.522"，与官方 release tag 对齐
  const version = fs
    .readFileSync(path.join(pkgRoot, 'VERSION'), 'utf8')
    .trim()
    .replace(/^v/, '');
  const baseDir = `assets/fonts/lxgw-wenkai/${version}`;

  return {
    name: 'lxgw-webfont',

    async loadContent() {
      return {version, baseDir};
    },

    async contentLoaded({content, actions}) {
      // 交给客户端组件用 usePluginData('lxgw-webfont') 拼出 <link> 的 href，
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

      const patterns = WEIGHTS.map(({dir, out}) => ({
        // 整目录拷：result.css 里的 url("./N.woff2") 相对于它自己解析，
        // 同一目录下的分片正好接得住。注意 rspack 的 CopyRspackPlugin
        // 不支持在 from 里写 glob，只能这样整目录拷再用 globOptions 排除。
        from: path.join(pkgRoot, dir),
        to: `${baseDir}/${out}`,
        toType: 'dir',
        globOptions: {ignore: IGNORED},
        info: {minimized: true},
      }));

      return {plugins: [new CopyPlugin({patterns})]};
    },
  };
};