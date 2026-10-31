// @ts-check
/**
 * 把 Excalidraw 的样式与字体拷到 build 下的版本化目录，供白板页按需注入。
 *
 * 为什么不像官方文档那样 `import '@excalidraw/excalidraw/index.css'`：
 *   1. Docusaurus 3.10 开了 `future.v4`，默认走 rspack，所有被 import 的 CSS
 *      都会合进全局 styles.css。实测全局样式会从 135KB(26KB gz) 涨到
 *      279KB(48KB gz)，等于让「从不打开白板」的访客也替白板买单；
 *   2. 它还是渲染阻塞资源，白板页才有意义。
 *
 * 字体同理：官方默认从 esm.sh CDN 拉（`ASSETS_FALLBACK_URL`），13MB/234 个
 * woff2 分片，既慢又依赖第三方。这里整目录拷到
 * `assets/excalidraw/<版本>/fonts/`，前端在挂载画布前设
 * `window.EXCALIDRAW_ASSET_PATH` 指向同一目录，运行时只按需拉当前字体分片。
 *
 * 版本号进路径 + 文件名带内容 hash（上游命名如此），适合远端 nginx 配
 * immutable 长缓存。
 */

const fs = require('node:fs');
const path = require('node:path');

/** 只拷这两处：样式表 + 字体；dev 构建产物（带 .map）一律不拷。 */
const PKG = '@excalidraw/excalidraw';

/**
 * 解析包根目录。
 *
 * 不能直接 `require.resolve('@excalidraw/excalidraw/package.json')`：
 * 该包的 `exports` 只暴露 `.` 与 `./index.css`，其余子路径（含 package.json）
 * 会被 Node 拒绝（ERR_PACKAGE_PATH_NOT_EXPORTED）。
 * 所以先解析包入口，再向上找第一个带 package.json 的目录。
 * （fs 读文件不受 exports 限制，后续读版本号没问题。）
 */
function resolvePkgRoot(siteDir) {
  let dir = path.dirname(require.resolve(PKG, {paths: [siteDir]}));
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`无法定位 ${PKG} 的包根目录`);
}

module.exports = function excalidrawAssetsPlugin(context) {
  const pkgRoot = resolvePkgRoot(context.siteDir);
  const version = JSON.parse(
    fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'),
  ).version;
  // 相对 baseUrl 的路径，不带前导斜杠，交给前端 useBaseUrl 处理
  const baseDir = `assets/excalidraw/${version}`;
  const prodDir = path.join(pkgRoot, 'dist/prod');

  return {
    name: 'excalidraw-assets',

    async contentLoaded({actions}) {
      // 前端要拼 <link href> 与 EXCALIDRAW_ASSET_PATH，版本号不能在前端硬编码。
      // fontsPath 末尾带斜杠：Excalidraw 内部按 baseUrl + 'fonts/...' 拼接。
      actions.setGlobalData({
        version,
        baseDir,
        stylesheet: `${baseDir}/index.css`,
        fontsPath: `${baseDir}/`,
      });
    },

    // 注意：configureWebpack 必须是同步的（Docusaurus 不 await 返回值）。
    configureWebpack(config, isServer, {currentBundler}) {
      // SSR 产物用不到样式和字体，白板本身也是纯客户端渲染
      if (isServer) {
        return {};
      }

      const CopyPlugin =
        currentBundler.name === 'rspack'
          ? currentBundler.instance.CopyRspackPlugin
          : require('copy-webpack-plugin');

      return {
        plugins: [
          new CopyPlugin({
            patterns: [
              // 样式表：单文件，保持与字体同目录，css 里的 url("./fonts/...") 相对解析
              {
                from: path.join(prodDir, 'index.css'),
                to: `${baseDir}/index.css`,
                info: {minimized: true},
              },
              // 字体：整目录拷（rspack 的 CopyRspackPlugin 不支持 from 写 glob）
              {
                from: path.join(prodDir, 'fonts'),
                to: `${baseDir}/fonts`,
                toType: 'dir',
                info: {minimized: true},
              },
            ],
          }),
        ],
      };
    },
  };
};
