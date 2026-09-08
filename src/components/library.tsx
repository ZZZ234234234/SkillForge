"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Search,
  Star,
  ArrowUpRight,
  Code2,
  GitBranch,
  FileText,
  FlaskConical,
  Database,
  Shield,
  Plus,
  Download,
  ArrowRight,
} from "lucide-react";
import type { Skill, Language } from "../types/skill";
import { scoreSkill } from "../features/inspector/engine";
import { categories } from "../features/skills/registry";
import { words, Pick } from "./controls";
export function Library({
  skills,
  lang,
  view,
  open,
  onFavorite,
  onInstall,
  onCreate,
  onGenerator,
  onImport,
}: {
  skills: Skill[];
  lang: Language;
  view: string;
  open: (s: Skill) => void;
  onFavorite: (s: Skill) => void;
  onInstall: (s: Skill) => void;
  onCreate: () => void;
  onGenerator: () => void;
  onImport: () => void;
}) {
  const t = words(lang);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("featured"),
    [favorites, setFavorites] = useState(false);
  const visible = skills
    .filter(
      (s) =>
        (view !== "installed" || s.status === "Installed") &&
        (view !== "mine" || ["Local", "Draft"].includes(s.status)) &&
        (view !== "registry" || s.status === "Registry") &&
        (!favorites || s.favorite) &&
        (category === "all" || s.category === category) &&
        `${s.displayName} ${s.description} ${s.tags.join(" ")} ${s.author}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "quality"
        ? scoreSkill(b).overall - scoreSkill(a).overall
        : sort === "name"
          ? a.displayName.localeCompare(b.displayName)
          : sort === "newest"
            ? b.updatedAt.localeCompare(a.updatedAt)
            : Number(a.metadata.curatedOrder ?? 999) -
              Number(b.metadata.curatedOrder ?? 999),
    );
  const icons = [Code2, GitBranch, FileText, FlaskConical, Database, Shield];
  return (
    <div className="library-page">
      {view === "explore" ? (
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-mark" /> THE WORKSPACE FOR AGENT SKILLS
            </div>
            <h1>
              Build better skills
              <br />
              for AI agents<span className="accent">.</span>
            </h1>
            <p>
              {t(
                "创建、检查、测试与管理 AI Agent Skills。",
                "Build, test, inspect and manage AI Agent Skills.",
              )}
              <br />
              {t(
                "从一份说明，到可以验证的专业能力。",
                "From a set of instructions to a capability you can verify.",
              )}
            </p>
            <div className="actions">
              <button className="primary" onClick={onCreate}>
                <Plus size={16} />
                {t("创建 Skill", "Create Skill")}
              </button>
              <button className="secondary" onClick={onImport}>
                <Download size={16} />
                {t("导入 Skill", "Import Skill")}
              </button>
              <Link className="text-button" href="/demo">
                Explore Demo <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <div className="intro-code">
            <div className="code-title">
              <span className="file-icon">M↓</span> SKILL.md{" "}
              <span className="badge">PORTABLE BY DESIGN</span>
            </div>
            <div className="code-sample">
              <span className="muted">01&nbsp; ---</span>
              <br />
              <span className="muted">02&nbsp; </span>
              <span className="accent">name:</span> react-code-reviewer
              <br />
              <span className="muted">03&nbsp; </span>
              <span className="accent">description:</span> Review with evidence.
              <br />
              <span className="muted">04&nbsp; ---</span>
              <br />
              <span className="muted">05</span>
              <br />
              <span className="muted">06&nbsp; </span>
              <span className="code-blue">## Workflow</span>
              <br />
              <span className="muted">07&nbsp; </span>1. Inspect the changes
              <br />
              <span className="muted">08&nbsp; </span>2. Trace the behavior
              <br />
              <span className="muted">09&nbsp; </span>3. Verify the findings
            </div>
            <div className="code-footer">
              <Shield size={13} />
              {t(
                "可阅读 · 可检查 · 可移植",
                "Readable · Inspectable · Portable",
              )}
            </div>
          </div>
        </section>
      ) : (
        <div className="page-title">
          <p className="eyebrow">YOUR SKILL WORKSPACE</p>
          <h1>
            {view === "registry"
              ? t("开放技能目录", "Open Registry")
              : view === "installed"
                ? t("已安装", "Installed Skills")
                : t("我的技能", "My Skills")}
          </h1>
          <p className="muted">
            {view === "registry"
              ? t(
                  "随项目分发的开放示例目录。欢迎通过 PR 贡献；不展示虚构热度。",
                  "A bundled open registry. Contribute by pull request; no invented popularity metrics.",
                )
              : t(
                  "数据保存在当前浏览器中。请定期导出备份。",
                  "Stored in this browser. Export regularly for backup.",
                )}
          </p>
        </div>
      )}
      {view === "explore" && (
        <button className="generator-strip" onClick={onGenerator}>
          <span className="spark-mark">✧</span>
          <span>
            <strong>
              {t("让想法成为 Skill", "Turn an idea into a skill")}
            </strong>
            <span className="muted">
              {t(
                "用一句话描述任务，生成后审阅、改进与测试。",
                "Describe a task, then review, refine and test the result.",
              )}
            </span>
          </span>
          <span className="strip-cta">
            {t("打开生成器", "Open Generator")}
            <ArrowRight size={16} />
          </span>
        </button>
      )}
      <div className="section-top">
        <div className="heading-with-count">
          <h2>
            {view === "registry"
              ? t("浏览目录", "Browse registry")
              : t("技能库", "Skill Library")}
          </h2>
          <span className="badge">{visible.length}</span>
        </div>
        <span className="small muted">
          {t("精选示例 · Demo Data", "Curated examples · Demo Data")}
        </span>
      </div>
      <div className="library-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label={t("搜索技能", "Search skills")}
            placeholder={t(
              "搜索名称、标签或关键词…",
              "Search names, tags or keywords…",
            )}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </div>
        <Pick
          label="Sort skills"
          value={sort}
          onChange={setSort}
          items={[
            { value: "featured", label: t("编辑精选", "Featured") },
            { value: "newest", label: t("最近更新", "Newest") },
            { value: "quality", label: t("质量评分", "Quality score") },
            { value: "name", label: t("名称", "Name") },
          ]}
        />
        <button
          className={"icon-button " + (favorites ? "active" : "")}
          aria-label={t("仅收藏", "Favorites only")}
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          <Star size={17} />
        </button>
      </div>
      <div className="category-tabs">
        <button
          className={category === "all" ? "selected" : ""}
          onClick={() => setCategory("all")}
        >
          {t("全部技能", "All skills")}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="skill-grid">
        {visible.map((s) => {
          const Icon =
              icons[categories.indexOf(s.category) % icons.length] ?? Code2,
            score = scoreSkill(s).overall;
          return (
            <article key={s.id} className="skill-card">
              <div className="spread">
                <span className={"skill-icon icon-" + s.category.toLowerCase()}>
                  <Icon size={22} />
                </span>
                <button
                  className={"favorite " + (s.favorite ? "on" : "")}
                  aria-label={`${t("收藏", "Favorite")} ${s.displayName}`}
                  aria-pressed={s.favorite}
                  onClick={() => onFavorite(s)}
                >
                  <Star size={16} fill={s.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <button className="card-open" onClick={() => open(s)}>
                <h3>
                  {s.displayName}
                  <ArrowUpRight size={15} />
                </h3>
                <p>{s.description}</p>
              </button>
              <div className="tag-list">
                {s.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="card-meta">
                <span className="mono">v{s.version}</span>
                <span>{s.category}</span>
                <span className="quality-mini">
                  <span />
                  {score}
                  <span className="muted">/100</span>
                </span>
              </div>
              <div className="card-bottom">
                <span>
                  {s.status} {s.metadata.demo ? "· Demo" : ""}
                </span>
                {s.status === "Registry" ? (
                  <button onClick={() => onInstall(s)}>
                    <Plus size={13} />
                    {t("安装", "Install")}
                  </button>
                ) : (
                  <button onClick={() => open(s)}>
                    {t("编辑", "Edit")}
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="empty">
          <Search size={28} />
          <h3>{t("没有找到技能", "No skills found")}</h3>
          <p>
            {t(
              "调整搜索条件，或创建、导入你的第一个 Skill。",
              "Adjust your filters, or create and import your first skill.",
            )}
          </p>
          <button onClick={onCreate} className="secondary">
            {t("创建 Skill", "Create Skill")}
          </button>
        </div>
      )}
      <footer className="workspace-footer">
        <span>LOCAL-FIRST. OPEN SOURCE. YOUR SKILLS.</span>
        <span>
          SkillForge <span className="mono">v0.1.1</span>
        </span>
      </footer>
    </div>
  );
}
