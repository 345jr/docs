import React from 'react';
import NavbarItem from '@theme-original/NavbarItem';
import FontPicker from '@site/src/components/FontPicker';
import ThemePicker from '@site/src/components/ThemePicker';
import SectionLink from '@site/src/components/SectionLink';

/**
 * 单页栏目：整块栏目只有一个页面实例，但路径里还有子路径
 * （/whiteboard/<文件名>、/private/<分类>/<文档>）。
 * 已经身处其中时再点导航项，不应该再触发一次路由。
 */
const SECTION_BY_TO = {
  '/whiteboard': 'whiteboard',
  '/private': 'private',
  '/editor': 'editor',
};

// 支持 docusaurus.config.js 中的自定义导航项类型：
//   custom-fontPicker / custom-themePicker / custom-sectionLink
// 其余类型原样转发给官方 NavbarItem。
export default function NavbarItemWrapper(props) {
  if (props.type === 'custom-fontPicker') {
    return <FontPicker {...props} />;
  }
  if (props.type === 'custom-themePicker') {
    return <ThemePicker {...props} />;
  }
  if (props.type === 'custom-sectionLink') {
    // 官方 NavbarItem 不接受任意 component，所以自定义类型直接渲染成
    // navbar__link 观感的链接，而不是塞进默认项里。
    return (
      <SectionLink
        className="navbar__item navbar__link"
        section={props.section}
        to={props.to}>
        {props.label}
      </SectionLink>
    );
  }
  return <NavbarItem {...props} />;
}
