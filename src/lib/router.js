import { useEffect, useState } from "react";

export const pageTitles = {
  home: "水豚旅行 | 多人旅行记账与分摊",
  create: "选择记账模式 | 水豚旅行",
  "create-parent": "大家长模式 | 水豚旅行",
  "create-shared": "多人付款模式 | 水豚旅行",
  manage: "已有行程 | 水豚旅行",
  archive: "行程存档 | 水豚旅行",
  detail: "行程详情 | 水豚旅行",
  expense: "记一笔 | 水豚旅行",
  budget: "增加预算 | 水豚旅行",
  review: "结算 | 水豚旅行",
  summary: "结算总结 | 水豚旅行",
  about: "产品介绍 | 水豚旅行"
};

function normalizePath(pathname) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = pathname;
  if (base && base !== "/" && path.startsWith(base)) path = path.slice(base.length);
  return path || "/";
}

export function parseRoute() {
  const hash = window.location.hash.startsWith("#/") ? window.location.hash.slice(1) : "";
  const source = hash || normalizePath(window.location.pathname);
  const [rawPath, rawQuery = ""] = source.split("?");
  const segment = rawPath.replace(/^\/+|\/+$/g, "").replace(/\.html$/i, "") || "home";
  const route = segment === "index" ? "home" : segment;
  return {
    name: route,
    params: new URLSearchParams(hash ? rawQuery : window.location.search)
  };
}

export function hrefTo(route = "home", params = {}) {
  const query = new URLSearchParams(params);
  return `#/${route === "home" ? "" : route}${query.size ? `?${query.toString()}` : ""}`;
}

export function navigate(route, params) {
  window.location.hash = hrefTo(route, params);
}

export function useRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    document.title = pageTitles[route.name] || pageTitles.home;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route.name]);
  return route;
}
