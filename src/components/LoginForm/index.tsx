import React, {useState} from 'react';
import styles from './styles.module.css';

/**
 * 共享的解锁/登录表单：在线编辑与私有文档页复用同一套视觉，仅标题不同。
 * onSubmit 抛错时展示 toast 由调用方处理（这里只保证 loading 态正确）。
 */
export default function LoginForm({
  title,
  placeholder = '密钥',
  submitLabel = '进入',
  onSubmit,
}: {
  title: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (key: string) => Promise<void>;
}): React.ReactNode {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !key) return;
    setLoading(true);
    try {
      await onSubmit(key);
      setKey('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.login}>
        <h1 className={styles.loginTitle}>{title}</h1>
        <form className={styles.loginForm} onSubmit={submit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <button type="submit" className={styles.loginBtn} disabled={loading || !key}>
            <span>{loading ? '处理中…' : submitLabel}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2 8h11M9 3.5 13.5 8 9 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
