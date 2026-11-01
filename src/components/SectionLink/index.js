import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * 单页栏目的导航链接：已经在目标栏目里时，点击不产生任何跳转。
 *
 * 默认的 `to="/whiteboard"` 在 `/whiteboard/<文件名>` 下依然可点：点一下会把
 * 地址栏从 `/whiteboard/xxx.excalidraw` 改成 `/whiteboard`，白板页据此把当前
 * 板置空、再按「自动打开最近一块」重新加载一遍画布，画布组件重新挂载 ——
 * 用户看到的就是闪一下，而他本来就想待在这页。
 *
 * 这里保留 `<a>` 而不是换成 `<button>`：导航栏的排版、hover、focus 样式都
 * 依赖 `.navbar__link`，换标签会让三处栏目的观感和其他项不一致。
 * 高亮沿用官方的 `isNavLink` + `activeClassName`，不自己拼 class。
 */
export default function SectionLink({to, children, onClick, ...props}) {
  const href = useBaseUrl(to);
  const base = href.replace(/\/$/, '');

  // 栏目判定：同前缀且下一段是边界（`/private` 不该匹配 `/privates`）。
  // 官方 NavbarNavLink 用的是裸 startsWith，子路径能高亮但边界不严，这里补上。
  const inSection = (pathname) =>
    pathname === base ||
    pathname === `${base}/` ||
    pathname.startsWith(`${base}/`);

  return (
    <Link
      {...props}
      to={href}
      isNavLink
      activeClassName="navbar__link--active"
      isActive={(_match, location) => inSection(location.pathname)}
      onClick={(event) => {
        // 已经在这一栏：不路由、不滚动、不重新加载
        if (typeof window !== 'undefined' && inSection(window.location.pathname)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}>
      {children}
    </Link>
  );
}
