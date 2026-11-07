"use client";

/* 全局错误兜底:客户端渲染崩溃时如实展示错误,不白屏不静默 */
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);
  return (
    <html lang="zh-CN">
      <body style={{ background: "#0a0f1e", color: "#ededed", fontFamily: "system-ui", padding: 40 }}>
        <div style={{ maxWidth: 720, margin: "80px auto" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>页面渲染出错了</h1>
          <p style={{ fontSize: 13, color: "#a0a0a0", marginBottom: 16 }}>
            如实展示错误信息(不静默):{error.message}
          </p>
          {error.digest && <p style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>digest: {error.digest}</p>}
          <pre style={{
            fontSize: 11, whiteSpace: "pre-wrap", background: "#141a2e",
            padding: 16, borderRadius: 8, maxHeight: 300, overflow: "auto",
            border: "1px solid #2a3350",
          }}>
            {error.stack ?? "(无堆栈)"}
          </pre>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "8px 20px", background: "#7c6cff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
