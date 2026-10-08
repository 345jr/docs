---
title: 可切换正文字体
sidebar_position: 3
description: 顶栏那个字体选择器，从一个 3MB 的非授权 ttf 起步，中间发现了"标题变粗是因为浏览器在合成伪粗体"，最后收敛成两种 OFL 开源字体、按需加载、全局样式表回到 22KB。记录三个改动和两个只有跑浏览器才看得见的 bug。
tags: [站点建设, 前端, Docusaurus, CSS, 字体, 性能]
---

# 可切换正文字体

顶栏现在有个字体选择器，可以在**系统默认 / 霞鹜文楷 / 思源宋体**之间切换正文用的字体，侧边栏和导航栏不受影响。

这个功能最初的版本和现在几乎没有共同点——它当时提交了一个 3MB 的 `.ttf` 进仓库，用的是一个字体停在 2023 年的第三方包，标题的粗体是浏览器合成的假粗体，而且字体清单让全站样式表膨胀了 3.4 倍。

中间经历了三次改动。这篇文章记录每次改了什么、为什么，以及两个**只有真正跑起浏览器才暴露**的 bug。

## 一、最初版本

第一个版本（`57a95a4`）的需求很简单：中文文档用系统默认字体在 Linux 下很难看，想要一个能手动换成楷体 / 宋体的开关。

实现上拆成两套完全不同的加载方式：

- **霞鹜文楷**走 `lxgw-wenkai-screen-webfont`，unicode-range 分片 woff2，浏览器按可见字符下载；
- **方正宋三**是单个 ttf，通过 `FontFace` API 懒加载，并弹 toast 提示。

字体只作用于 `.main-wrapper main`，侧边栏和导航栏保持原样；选择结果存 localStorage，在 `useEffect` 里恢复以避免 hydration mismatch。这些到今天都还成立。

但代码跑起来之后，我review 出四个问题。

## 二、四个问题

### 字体版本停在 2023 年

这个包名叫 `lxgw-wenkai-screen-webfont`，来自第三方 `chawyehsu/lxgw-wenkai-webfont`，而不是 `lxgw/LxgwWenkai` 本体。更关键的是包里那个 `VERSION` 文件写着 **v1.250.2，日期 2023-01-18**——也就是说包版本号一直在更新（1.3 → 1.7），但**字体文件本身三年没动过**。

顺带翻出两个细节：这个包提供了 `GB` 和 `Screen R` 变体，但我把 GB 变体的 woff2 内部 name 表读出来发现，它的 CSS 里 `font-family` 写的是 `'LXGW WenKai Screen'`，而字体内部名其实是 `LXGW WenKai GB Screen`——**上游的 CSS 写错了**，同时引入会互相覆盖。另外我对比了 `Screen` 和 `Screen R` 的 glyf 表哈希，完全一致，只是 name table 差 12 字节，没必要用 R 版。

### 标题的粗体是假的

霞鹜文楷只有 `font-weight: 400` 一个字重，而 Infima 的标题是 `--ifm-heading-font-weight: bold`（700）。浏览器找不到 700，就只能**合成**一个——这就是"粗体怪怪的"的真正原因。它不是 CSS 写错了，是**这个字体压根没有 Bold**。

这一条后来成了整个改造的支点。

### 字体清单让全局样式表膨胀 3.4 倍

因为 `import '.../result.css'` 写在 React 组件里，被 CSS 提取工具抽进了**全局** `styles.css`。实测：

```
改造前  styles.css  232KB raw / 75.8KB gzip
        其中 @font-face  115KB raw / 52.2KB gzip
去掉字体  117KB raw / 22.0KB gzip
```

也就是说：**即使用户从头到尾都用系统默认字体，也要为这 52KB 阻塞渲染的 CSS 买单。** 而且这些 `@font-face` 是 221 条（Regular）——如果再加一个字重就是 442 条。

### 方正宋三没有授权

`FZSongS.ttf` 里写着 `Copyright(c) Founder Corporation.2000`。方正系列字体**不是**开源字体，必须通过[字加客户端](https://www.foundertype.com/index.php/About/powerbus.html)购买个人或企业授权。

我核对了 [FreeFronts](https://github.com/ShuShuHong/FreeFronts)（收录 78 款可商用中文字体），它明确标注方正书宋、方正仿宋属于「需官方客户端授权」，仓库不收录字体文件。而我们把这个 ttf 提交在了一个**公开仓库**里，并部署在公网站点上。这不是"能凑合"的问题，是实打实的合规风险。

## 三、改造：换官方字体，标题走真字重

### 换掉来源

顺着"这个包字体不更新"的线索，我在 npm 上找到了跟随官方 release 的包 `@callmebill/lxgw-wenkai-web`——它的版本号就是官方 release tag，**1.522，对应 2026-03-17**，正是当时 `lxgw/LxgwWenKai` 的最新版本。

关键是**同一个包里还有 Medium 字重**。霞鹜文楷从 v1.300 起加了 Medium，本来就是给标题用的。于是：

| 元素 | 改造前 | 改造后 |
| --- | --- | --- |
| 正文 | LXGW WenKai Screen 400 | `LXGW WenKai` 400 |
| h1–h6 | Screen 400，**合成粗体** | `LXGW WenKai Medium` **500 真字重** |
| `<strong>` `<b>` | 同上，合成粗体 | Medium 500 |
| 表头 `<th>` | 同上，合成粗体 | Medium 500 |
| 代码块 | 等宽 ✓ | 等宽 ✓ |

这里有个不明显的坑：**Regular 和 Medium 在 CSS 里是两个独立的 family**（`'LXGW WenKai'` 和 `'LXGW WenKai Medium'`），而不是同一 family 下的两个 weight。所以没法只靠 `font-weight` 解决，必须在 CSS 上再开一个变量：

```css
.main-wrapper main { font-family: var(--site-content-font); }

.main-wrapper main :is(h1, h2, h3, h4, h5, h6),
.main-wrapper main :is(strong, b),
.main-wrapper main th {
  font-family: var(--site-emphasis-font);   /* 霞鹜文楷下 = Medium */
}
```

三个变量 `--site-content-font` / `--site-emphasis-font` / `--site-heading-weight` 的默认值都是"跟随正文"，所以切回系统默认时什么都不用设。

表头 `<th>` 是后加的——改完之后我顺手查了一遍所有会被加粗的元素，发现 `<th>` 仍然是 700 + 只有 400 的 family，还在合成粗体。

### 让字体 CSS 别进全局

52KB gzip 的阻塞资源不能一直挂着。理想做法是动态 `import()` 那个 CSS，让打包器拆出独立 chunk。**我试了，无效。**

原因在 Docusaurus 3.10：项目开了 `future.v4`，而 `v4` 意味着 `fasterByDefault: true`，默认走 rspack 而不是 webpack。rspack 会把所有 CSS 合进一个 `styles.css`，动态 import 也拆不出独立 chunk。构建后一 grep，448 条 `@font-face` 全在全局文件里。

那就绕过打包器：**构建时把字体资源拷到 `assets/fonts/` 下，前端在用户真正选中时才手动注入 `<link>`**。为此写了一个 `plugins/cjk-webfonts` 插件，用 `CopyPlugin` 把包里的字重目录整个拷到 `build/assets/fonts/<字体>/<版本>/<字重>/`，路径里的版本号直接读包里的 `VERSION` 文件，前端通过 `usePluginData` 拿到路径再拼 `<link>`。

效果：

```
改造后  styles.css  117KB raw / 22.1KB gzip，0 条 @font-face
```

顺带对比了一下两种字体的实际开销（用站内 9 篇文档的真实字符集算的）：

| 字体 | 分片数 | 全量 | 单页中位 |
| --- | --- | --- | --- |
| 霞鹜文楷 Regular | 221 | 10.7MB | 753KB |
| 思源宋体 Regular | 101 | 3.0MB | 657KB |

宋体反而比楷体轻——笔画规整，woff2 压得更狠。

## 四、换掉方正宋三

思源宋体（Source Han Serif / Noto Serif SC）是 Adobe 和 Google 联合开发的开源宋体，SIL OFL 1.1，官方最新版 2.003。它是中文宋体里覆盖最全、也最常被用来替代方正书宋的一个。

选包的时候排掉了几个：

- `@fontsource/noto-serif-sc` 字体版本最新（2.003），但**没有 unicode-range 切片**，整个简体是一个 1.47MB 的单文件，反而更重；
- `noto-serif-sc`（切片版）字体是 2.002，稍旧一版，但有 101 片切片，单页 657KB。选了它；
- 朱雀仿宋（OFL，v0.212）虽然火，但只有 400 单字重、还是仿宋不是宋体、单页 1.1KB 最重，不合适。

换成思源宋体之后有个意外收获：**它的 Regular 和 Bold 同属 `Noto Serif SC` 一个 family**。也就是说标题直接吃 `font-weight: 700` 就命中真 Bold，一个额外变量都不需要——连带把方正宋三原先的伪粗体问题也解决了。

```tsx
{value: 'notoSerif', label: '思源宋体', family: "'Noto Serif SC'"}
// emphasis / headingWeight 留空即可
```

最后把 `static/fonts/FZSongS.ttf` 从仓库删掉，`FontPicker` 里那段 `FontFace` API 加载 ttf 的逻辑整段消失，组件短了一大截。

## 五、两个只有跑浏览器才看得见的 bug

改造过程中有两次"代码看起来完全正确"但功能不工作，值得单独记一笔。

### `configureWebpack` 写成 `async` 会被静默丢弃

插件里的 `configureWebpack` 我写成了 `async`，因为里面要 `await getCopyPlugin()`。构建**成功**，没有任何报错，但一个文件都没拷出来。

原因在 Docusaurus 源码：

```js
const { mergeStrategy, ...res } = configureWebpack(config, ...) ?? {};
```

它**直接**把返回值当 webpack config 用，从不 `await`。一个 Promise 的自有可枚举属性是空的，于是 `res` 恒等于 `{}`。整个插件被无声无息地丢掉了——连 `console.error` 都不会打。

正确写法是保持同步，`currentBundler` 已经是解析好的对象，直接按名字取插件类：

```js
configureWebpack(config, isServer, {currentBundler}) {
  const CopyPlugin = currentBundler.name === 'rspack'
    ? currentBundler.instance.CopyRspackPlugin
    : require('copy-webpack-plugin');
  return {plugins: [new CopyPlugin({patterns})]};
}
```

### global data 的 key 变成了字符串 `"undefined"`

泛化插件时，`loadContent` 里这么取：

```js
Object.fromEntries(fonts.map(({key, version, baseDir}) => [key, {...}]))
```

但上游那个 `.map()` 返回的对象里我**漏掉了 `key` 字段**。构建产物里：

```json
"cjk-webfonts": {"default": {"undefined": {"version": "31.0.0", ...}}}
```

前端的 `usePluginData('cjk-webfonts').lxgw` 于是是 `undefined`，`hrefsOf()` 返回空数组，`<link>` 一个都没插。

这个 bug 特别恶心的地方在于**表面症状完全正常**：`getComputedStyle(el).fontFamily` 返回的是 CSS 变量解析出的值，跟字体到底加载没加载毫无关系——即使一个 `@font-face` 都没有，它照样显示 `"LXGW WenKai"`。我是盯着"请求数怎么是 0"才发现不对的。

:::warning[教训]
`getComputedStyle().fontFamily` 告诉你的是**请求了哪个字体**，不是**实际用了哪个字体**。要确认真生效，得看 `document.fonts` 里对应的 face `status === 'loaded'`，或者数网络请求。
:::

## 六、怎么验证的

因为上面两个 bug 都属于"不报错但不对"，这次改完专门用 Playwright 跑了一遍真实浏览器。列出验证清单，下次改字体相关的东西可以直接照着抄：

1. **首屏不发字体请求** —— 系统默认下 `page.on('request')` 里 `/assets/fonts/` 命中数必须是 0；
2. **切换后只拉该字体的 CSS** —— 霞鹜文楷是 2 个 `result.css`，思源宋体是 2 个 `css.css`；
3. **重复切换命中缓存** —— 再切一次应该是 0 个新请求；
4. **face 真的 loaded** —— `document.fonts` 里 `'Noto Serif SC'@700` 状态为 `loaded`，而不是 `unloaded`；
5. **代码块不被污染** —— `<pre><code>` 的 computed font-family 仍是 `SFMono-Regular`；
6. **刷新后能恢复** —— localStorage 里的选择要自动应用回来；
7. **构建产物自查** —— 448 / 202 条 `@font-face` 全部能在磁盘上找到对应文件，0 个缺失。

顺带发现一件事：远端 nginx 对 `/assets/` 已经配了 `cache-control: public, max-age=31536000, immutable`，而字体产物路径带版本号、文件名稳定，正好吃满这个策略。所以字体一旦加载过，之后就是纯命中缓存。

## 七、最后

最终形态是三个选项，两种中文字体都是 OFL 授权，FontPicker 里没有一个多余的转接逻辑：

- 霞鹜文楷 —— 官方 v1.522，正文 Regular + 标题 Medium（两个 family，需要 `--site-emphasis-font` 转接）；
- 思源宋体 —— v2.002，正文 Regular + 标题 Bold（同一 family，`font-weight` 直接命中）。

如果要再加一个字体，改动很小：在 `plugins/cjk-webfonts/index.js` 的 `FONTS` 数组里登记一行（包名 + 要拷的字重目录 + 各字重的 CSS 文件名），产物路径和前端 `<link>` 会自动跟上；再在 FontPicker 的 `FONTS` 里加一个选项。

:::tip[三条要记住的]
1. **中文 webfont 一定要挑切片版**，而且切片版是"按需下载"的前提；没有 `unicode-range` 分片的包就是一次性下整个字体。
2. **加粗难看先查字重**。中文开源字体大多只有一个 400，标题的"粗体"很可能全是浏览器合成的。找同包的 Medium / SemiBold 才是正解。
3. **中文商用别碰方正系列**。需要授权的字体不应该进仓库、也不应该部署到公网，随便一个 OFL 的开源替代通常就够用。
:::