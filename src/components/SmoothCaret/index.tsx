import {useEffect, useRef} from 'react';
import type {CaretStyle, SmoothCaretProps} from '../../types/editorTypes';
import styles from './styles.module.css';

/** 停止打字后多久恢复闪烁：打字时光标常亮（对标 Monkeytype） */
const IDLE_RESUME_MS = 900;

/** 样式类映射：外层 div 只负责定位，内层按样式画形状 */
const SHAPE_CLASS: Record<CaretStyle, string> = {
  line: styles.shapeLine,
  block: styles.shapeBlock,
  underline: styles.shapeUnderline,
  outline: styles.shapeOutline,
};

/**
 * Monkeytype 式平滑假光标。
 *
 * 原理：原生光标用 `caret-color: transparent` 藏掉（见 editor.module.css 的
 * `.richWrap[data-smooth-caret]` 规则），这里用 `view.coordsAtPos()` 拿到
 * 选区坐标，把一个 div 用 transform 定位过去，移动靠 CSS transition 滑行。
 *
 * 几个关键点：
 * - 只在精细指针设备（鼠标/触控板）启用，触屏直接返回 null、保留原生光标。
 * - 中文 IME 组词期间（`view.composing`）不做滑行动画、直接定位，
 *   候选框跟的是原生选区（它还在，只是透明），所以输入法不受影响。
 * - 选中一段文字（非折叠选区）/ 失焦时隐藏，选区高亮本身不受影响。
 * - 光标 div 放在滚动内容流里，随内容一起滚，不用监听 scroll。
 */
export default function SmoothCaret({editor, caretStyle}: SmoothCaretProps) {
  const caretRef = useRef<HTMLDivElement | null>(null);
  const idleTimer = useRef<number>(0);
  const firstPlace = useRef<boolean>(true);

  useEffect(() => {
    const caret = caretRef.current;
    if (!caret || !editor) return undefined;
    // 触屏设备：不启用假光标，原生光标（含拖拽手柄）必须保留
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;
    const wrap = caret.parentElement;
    if (!wrap) return undefined;
    wrap.setAttribute('data-smooth-caret', 'on');

    const hide = () => {
      window.clearTimeout(idleTimer.current);
      caret.classList.add(styles.caretHidden);
    };

    const place = (animate: boolean) => {
      const view = editor.view;
      const sel = editor.state.selection;
      if (!view.editable || !view.hasFocus() || !sel.empty) {
        hide();
        return;
      }
      let coords;
      try {
        coords = view.coordsAtPos(sel.from);
      } catch {
        hide();
        return;
      }
      const box = wrap.getBoundingClientRect();
      const height = Math.max(coords.bottom - coords.top, 8);
      // 打字时常亮，停手后再恢复闪烁
      caret.classList.add(styles.caretSolid);
      caret.classList.remove(styles.caretHidden);
      // 首次定位 / IME 组词中：关掉 transition 直接贴过去，避免从 (0,0) 滑过来
      caret.style.transition = !animate || firstPlace.current || view.composing ? 'none' : '';
      caret.style.transform = `translate(${coords.left - box.left}px, ${coords.top - box.top}px)`;
      caret.style.height = `${height}px`;
      firstPlace.current = false;
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        caret.classList.remove(styles.caretSolid);
      }, IDLE_RESUME_MS);
    };

    const onTransaction = () => place(true);
    const onFocus = () => place(false);
    const onSelectionChange = () => {
      if (editor.view.hasFocus()) place(true);
    };
    const onResize = () => place(false);

    editor.on('transaction', onTransaction);
    editor.on('focus', onFocus);
    editor.on('blur', hide);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('resize', onResize);
    // 挂载时若已聚焦（如切换文件后自动聚焦），立刻定位一次
    place(false);

    return () => {
      window.clearTimeout(idleTimer.current);
      editor.off('transaction', onTransaction);
      editor.off('focus', onFocus);
      editor.off('blur', hide);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('resize', onResize);
      wrap.removeAttribute('data-smooth-caret');
    };
  }, [editor]);

  return (
    <div ref={caretRef} className={`${styles.caret} ${styles.caretHidden}`} aria-hidden="true">
      <div className={`${styles.shape} ${SHAPE_CLASS[caretStyle]}`} />
    </div>
  );
}
