"use client";

/* 客户接待入口:店铺专属 H5 链接 + 二维码(客户扫码 → 销售喵真实接待) */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import CatCharacter from "./CatCharacter";

export default function CustomerEntryCard({ storeSlug }: { storeSlug: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}/customer/${storeSlug}` : "";

  useEffect(() => {
    import("qrcode").then((QR) => {
      QR.toDataURL(url, { width: 220, margin: 1, color: { dark: "#0A0F1E", light: "#FFFFFF" } })
        .then(setQr);
    });
  }, [url]);

  return (
    <div className="surface p-5 flex items-center gap-5 relative overflow-hidden">
      <div className="aurora" style={{ width: 240, height: 150, bottom: -60, left: "20%", background: "rgba(62,207,142,.13)" }} />
      <div className="relative shrink-0 w-[92px] h-[92px] rounded-xl overflow-hidden grid place-items-center" style={{ background: "#fff" }}>
        {qr ? <img src={qr} alt="客户接待二维码" className="w-full h-full" /> : <span className="text-[11px] anim-breathe" style={{ color: "var(--ink-3)" }}>生成中…</span>}
      </div>
      <div className="relative min-w-0">
        <div className="font-bold text-[15px]">接待入口 · 被动销售</div>
        <p className="text-[12.5px] mt-1 max-w-[520px]" style={{ color: "var(--ink-2)" }}>
          客户扫码进入 H5,销售喵用<b>真实目录价格</b>推荐、查<b>真实排班</b>、直接创建<b>真实预约</b>;
          预约会出现在任务墙,到店核销自动进财务账本。
        </p>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <a className="btn btn-green btn-sm" href={`/customer/${storeSlug}`} target="_blank" rel="noreferrer">
            打开客户页 <ExternalLink size={12} />
          </a>
          <Link className="text-[12px] hover:underline" style={{ color: "var(--brand-2)" }} href="/tasks">
            查看预约与任务 →
          </Link>
        </div>
      </div>
      <div className="relative ml-auto hidden md:block shrink-0">
        <CatCharacter colorway="calico" state="awake" accessory="envelope" size={64} working />
      </div>
    </div>
  );
}
