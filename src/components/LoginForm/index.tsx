import React, {useState} from 'react';

import styles from './styles.module.css';

/**
 * 共享的解锁/登录表单：在线编辑、私有文档、私有白板复用同一套视觉，仅标题不同。
 *
 * - 提交成功后由调用方处理跳转/状态与 toast；这里只清理输入框。
 * - 提交失败在本组件内联展示（调用方不再需要自己 catch 出 toast）。
 * - 提交按钮只有箭头图标，文字退到 aria-label / title 里。
 */
export default function LoginForm({
  title,
  hint = '输入访问密钥以继续',
  placeholder = '密钥',
  submitLabel = '进入',
  onSubmit,
}: {
  title: string;
  hint?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (key: string) => Promise<void>;
}): React.ReactNode {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !key.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(key);
      setKey('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.login}>
        <div className={styles.loginHead}>
          <h1 className={styles.loginTitle}>{title}</h1>
          {hint ? <p className={styles.loginHint}>{hint}</p> : null}
        </div>
        <form className={styles.loginForm} onSubmit={submit} noValidate>
          <div className={`${styles.loginRow} ${error ? styles.loginRowError : ''}`}>
            <input
              className={styles.loginInput}
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              aria-label={placeholder}
              aria-invalid={!!error}
              aria-describedby={error ? 'login-form-error' : undefined}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              autoFocus
            />
            <button
              type="submit"
              className={styles.loginBtn}
              disabled={loading || !key.trim()}
              aria-label={loading ? '处理中' : submitLabel}
              title={loading ? '处理中' : submitLabel}
            >
              {loading ? (
                <svg
                  className={styles.spinner}
                  width="17"
                  height="17"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true">
                  <circle
                    cx="8"
                    cy="8"
                    r="6.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    opacity="0.3"
                  />
                  <path
                    d="M8 1.75A6.25 6.25 0 0 1 14.25 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2 8h11M9 3.5 13.5 8 9 12.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
          {error ? (
            <p id="login-form-error" role="alert" className={styles.loginError}>
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

/** 后端错误原样是英文/HTTP 码，只有认得出含义时才展示，其余给一句中文兜底。 */
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message.trim() : '';
  if (!msg || /401|unauthori[sz]ed|invalid|forbidden/i.test(msg)) return '密钥不正确，请再试一次';
  return msg;
}
