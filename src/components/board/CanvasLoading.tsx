import React from 'react';
import styles from './styles.module.css';

/**
 * 画布区的统一 loading。
 *
 * 白板从「点进来」到「画布能画」之间要跨好几道异步：拉列表 → 读白板 →
 * 下载 Excalidraw 整包 → 初始化画布。这些阶段原本各渲染各的占位
 * （页面自己的转圈 + BrowserOnly 的纯文字 fallback + BoardCanvas 内部的
 * 纯文字 fallback），样式互不相同，切来切去就是用户看到的「闪」。
 *
 * 现在所有阶段共用这一个组件，只换文案，视觉上完全连续。
 * `visible=false` 时不卸载、只淡出，避免画布出现前一帧突然空一下。
 */
export default function CanvasLoading({
  visible,
  label = '正在加载',
}: {
  visible: boolean;
  label?: string;
}): React.ReactNode {
  return (
    <div
      className={styles.canvasLoading}
      data-hidden={visible ? undefined : ''}
      // 淡出后不再拦截鼠标，画布可以立刻交互
      aria-hidden={!visible}
      role={visible ? 'status' : undefined}
      aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.loadingText}>{label}</span>
    </div>
  );
}
