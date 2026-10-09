import React from 'react';
import NavbarItem from '@theme-original/NavbarItem';
import FontPicker from '@site/src/components/FontPicker';
import ThemePicker from '@site/src/components/ThemePicker';

// 支持 docusaurus.config.js 中的自定义导航项类型 custom-fontPicker /
// custom-themePicker，其余类型原样转发给官方 NavbarItem。
export default function NavbarItemWrapper(props) {
  if (props.type === 'custom-fontPicker') {
    return <FontPicker {...props} />;
  }
  if (props.type === 'custom-themePicker') {
    return <ThemePicker {...props} />;
  }
  return <NavbarItem {...props} />;
}
