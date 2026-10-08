/**
 * 补齐 `@theme/Layout` 的类型声明。
 *
 * 背景：`@docusaurus/module-type-aliases` 里 `@theme/Layout` 的 `Props` 只写了
 * `children`，而真正的实现（`@docusaurus/theme-classic/src/theme/Layout`）还
 * 支持 `title` / `description` / `noFooter` / `wrapperClassName`，完整声明在
 * `@docusaurus/theme-classic` 的 `theme-classic.d.ts` 里。
 *
 * IDE 只会加载前者，于是 `<Layout title="...">` 报
 * “Property 'title' does not exist on type 'IntrinsicAttributes & Props'”。
 * 这里显式引用 theme-classic 的声明，两个 ambient module 的 `interface Props`
 * 会按 TypeScript 的接口合并规则拼在一起，运行时行为不受任何影响。
 *
 * 将来升级 Docusaurus：① 上游把 title 也补进 module-type-aliases（同类型）→
 * 接口合并，无冲突；② 上游改了类型或 theme-classic 的 types 被改名删除 →
 * 最多只是 IDE 重新报错，删掉本文件这一行即可回到升级前的状态。
 * 构建（docusaurus build）不跑 tsc，类型问题不会影响 CI/CD。
 */
/// <reference types="@docusaurus/theme-classic" />
