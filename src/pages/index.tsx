/**
 * 首页外壳：只负责「当前用哪个主题」，具体渲染全部交给
 * src/home-themes/<主题>/ 下的组件（注册表见 home-themes/registry.ts）。
 *
 * SSR 与 hydration 首帧固定渲染默认主题；挂载后读 localStorage
 * 恢复用户选择，并监听导航栏「主题」模态框广播的切换事件
 * （两棵组件树，靠 CustomEvent 通信）以及跨标签页的 storage 事件。
 */
import React, {useEffect, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import {
  DEFAULT_HOME_THEME_ID,
  HOME_THEME_EVENT,
  HOME_THEME_STORAGE_KEY,
  getHomeTheme,
  readStoredHomeThemeId,
} from '../home-themes/registry';

export default function Home(): React.ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const [themeId, setThemeId] = useState<string>(DEFAULT_HOME_THEME_ID);

  useEffect(() => {
    setThemeId(readStoredHomeThemeId() ?? DEFAULT_HOME_THEME_ID);

    const onThemeChange = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setThemeId(getHomeTheme(id).id);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOME_THEME_STORAGE_KEY) {
        setThemeId(readStoredHomeThemeId() ?? DEFAULT_HOME_THEME_ID);
      }
    };
    window.addEventListener(HOME_THEME_EVENT, onThemeChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(HOME_THEME_EVENT, onThemeChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const {Component} = getHomeTheme(themeId);
  return (
    <Layout
      title={siteConfig.title}
      description="Lopop 的个人知识库：写作、沉淀与分享，让知识像四叶草一样生长。">
      <Component />
    </Layout>
  );
}
