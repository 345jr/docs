/**
 * 静态图片资源的模块声明。
 *
 * 构建时由 webpack asset modules 处理（`import img from './x.jpg'` 得到
 * 产物 URL），但 @docusaurus/module-type-aliases 只声明了 @theme/* 、
 * @generated/* 与 *.css，没有图片通配符，tsc 会报 TS2307，这里补上。
 *
 * 注意：不要声明 '*.svg'——Docusaurus 默认把 svg 交给 svgr，默认导出是
 * React 组件而不是 URL 字符串，类型不一样；本仓库 svg 目前都是内联 JSX，
 * 真要用到时再单独声明。
 */
declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}
