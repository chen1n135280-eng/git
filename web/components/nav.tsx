"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "总览", icon: "概" },
  { href: "/chapters/1", label: "理论学习", icon: "学" },
  { href: "/review", label: "内容审核", icon: "审" },
  { href: "/sources", label: "资料处理", icon: "料" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand" href="/">
        <span className="brand-seal">CPA</span>
        <span>
          <strong>理论研习室</strong>
          <small>把复杂知识讲明白</small>
        </span>
      </Link>
      <nav>
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.split("/1")[0]);
          return (
            <Link className={active ? "nav-item active" : "nav-item"} href={item.href} key={item.href}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <span className="eyebrow">第一阶段</span>
        <p>只做理论知识的整理、讲解与人工审核。</p>
      </div>
    </aside>
  );
}

