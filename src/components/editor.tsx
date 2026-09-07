"use client";
import { useRef, useState } from "react";
import {
  FileText,
  FileJson,
  Folder,
  Undo2,
  Redo2,
  Search,
  Copy,
  Download,
  Trash2,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Inspector } from "./inspector";
import { Pick, words } from "./controls";
import {
  skillMarkdown,
  skillReadme,
  parseSkill,
} from "../features/skills/parser";
import { skillSchema } from "../features/skills/schema";
import { redactSecrets, detectSecrets } from "../features/inspector/engine";
import type { Skill, Language } from "../types/skill";
export function Editor({
  skill,
  lang,
  onChange,
  onBack,
  onExport,
  onDuplicate,
  onDelete,
}: {
  skill: Skill;
  lang: Language;
  onChange: (s: Skill) => void;
  onBack: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = words(lang),
    [mode, setMode] = useState("form"),
    [file, setFile] = useState("SKILL.md"),
    [code, setCode] = useState(skillMarkdown(skill)),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const past = useRef<Skill[]>([]),
    future = useRef<Skill[]>([]),
    input = useRef<HTMLTextAreaElement>(null);
  const update = (patch: Partial<Skill>) => {
    past.current.push(structuredClone(skill));
    if (past.current.length > 60) past.current.shift();
    future.current = [];
    onChange({ ...skill, ...patch, updatedAt: new Date().toISOString() });
  };
  const undo = (redo = false) => {
    const from = redo ? future : past,
      to = redo ? past : future;
    const value = from.current.pop();
    if (value) {
      to.current.push(skill);
      onChange(value);
      setCode(
        file === "skill.json"
          ? JSON.stringify(value, null, 2)
          : skillMarkdown(value),
      );
    }
  };
  const choose = (f: string) => {
    setFile(f);
    setError("");
    setCode(
      f === "skill.json"
        ? JSON.stringify(skill, null, 2)
        : f === "README.md"
          ? skillReadme(skill)
          : f === "tests/cases.json"
            ? JSON.stringify(skill.tests, null, 2)
            : f === "examples/examples.json"
              ? JSON.stringify(skill.examples, null, 2)
              : skillMarkdown(skill),
    );
  };
  const applyCode = (text: string) => {
    setCode(text);
    try {
      if (file === "README.md") {
        setError(
          t(
            "README 自动生成，修改表单内容后重新导出。",
            "README is generated from form fields.",
          ),
        );
        return;
      }
      if (file === "tests/cases.json") {
        update({ tests: skillSchema.shape.tests.parse(JSON.parse(text)) });
      } else if (file === "examples/examples.json") {
        update({
          examples: skillSchema.shape.examples.parse(JSON.parse(text)),
        });
      } else {
        const p = parseSkill(text, file);
        update(
          file === "skill.json"
            ? { ...p, id: skill.id }
            : {
                role: p.role,
                goals: p.goals,
                instructions: p.instructions,
                workflow: p.workflow,
                tools: p.tools,
                constraints: p.constraints,
                inputFormat: p.inputFormat,
                outputFormat: p.outputFormat,
                errorHandling: p.errorHandling,
                examples: p.examples,
                tests: p.tests,
                name: p.name,
                description: p.description,
                license: p.license,
              },
        );
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid input");
    }
  };
  const fields: [keyof Skill, string, string, boolean?][] = [
    ["displayName", "显示名称", "Display name"],
    ["name", "目录名称", "Package name"],
    ["description", "触发场景与简介", "Description"],
    ["role", "角色", "Role"],
    ["goals", "目标 · 每行一项", "Goals · one per line", true],
    ["instructions", "核心说明", "Instructions"],
    ["workflow", "工作流程 · 每行一步", "Workflow · one per line", true],
    ["constraints", "约束 · 每行一项", "Constraints · one per line", true],
    ["inputFormat", "输入格式", "Input format"],
    ["outputFormat", "输出格式", "Output format"],
    ["errorHandling", "失败与错误处理", "Error handling"],
  ];
  return (
    <div className="editor-page">
      <div className="editor-heading">
        <button className="icon-button" onClick={onBack} aria-label="Back">
          <ArrowLeft size={17} />
        </button>
        <div>
          <h2>{skill.displayName}</h2>
          <span className="small muted">
            {skill.author} · v{skill.version} · {skill.status}
          </span>
        </div>
        <div className="editor-actions">
          <button
            className="icon-button"
            onClick={onDuplicate}
            title={t("复制技能", "Duplicate skill")}
          >
            <Copy size={16} />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="icon-button"
                aria-label={t("删除技能", "Delete skill")}
              >
                <Trash2 size={16} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("删除这个技能？", "Delete this skill?")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    "此操作将删除本地副本。请先导出需要保留的内容。",
                    "This deletes the local copy. Export anything you want to keep first.",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("取消", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  {t("删除", "Delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button className="primary" onClick={onExport}>
            <Download size={15} />
            {t("导出", "Export")}
          </button>
        </div>
      </div>
      <div className="editor-columns">
        <aside className="file-tree">
          <p className="eyebrow">EXPLORER</p>
          <div className="tree-root">
            <ChevronRight size={13} />
            <Folder size={14} />
            {skill.name}
          </div>
          {[
            "SKILL.md",
            "skill.json",
            "README.md",
            "examples/examples.json",
            "tests/cases.json",
          ].map((f) => (
            <button
              key={f}
              className={file === f ? "chosen" : ""}
              onClick={() => {
                choose(f);
                setMode("code");
              }}
            >
              {f.endsWith(".md") ? (
                <FileText size={14} />
              ) : (
                <FileJson size={14} />
              )}
              <span>{f}</span>
            </button>
          ))}
          <div className="tree-note">
            <ShieldCheck size={16} />
            {t(
              "仅保存在此浏览器。导出 ZIP 可备份到电脑。",
              "Saved in this browser. Export a ZIP to back up on disk.",
            )}
          </div>
        </aside>
        <section className="editing-surface">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v);
              choose(file);
            }}
          >
            <div className="editor-toolbar">
              <TabsList variant="line">
                <TabsTrigger value="form">{t("表单", "Form")}</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="preview">
                  {t("预览", "Preview")}
                </TabsTrigger>
                <TabsTrigger className="mobile-inspector-tab" value="inspector">
                  Inspector
                </TabsTrigger>
              </TabsList>
              <div className="actions">
                <button
                  className="icon-button"
                  aria-label="Undo"
                  onClick={() => undo()}
                >
                  <Undo2 size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Redo"
                  onClick={() => undo(true)}
                >
                  <Redo2 size={15} />
                </button>
              </div>
            </div>
            <TabsContent value="form">
              <div className="skill-form">
                {fields.map(([key, zh, en, list]) => (
                  <label key={key}>
                    <span>{t(zh, en)}</span>
                    {["name", "displayName"].includes(key) ? (
                      <input
                        value={String(skill[key])}
                        onChange={(e) => update({ [key]: e.target.value })}
                      />
                    ) : (
                      <textarea
                        rows={
                          key === "instructions"
                            ? 8
                            : key === "workflow"
                              ? 5
                              : 3
                        }
                        value={
                          list
                            ? (skill[key] as string[]).join("\n")
                            : String(skill[key])
                        }
                        onChange={(e) =>
                          update({
                            [key]: list
                              ? e.target.value.split("\n")
                              : e.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
                <div className="form-row">
                  <label>
                    {t("版本", "Version")}
                    <input
                      value={skill.version}
                      onChange={(e) => update({ version: e.target.value })}
                    />
                  </label>
                  <label>
                    {t("作者", "Author")}
                    <input
                      value={skill.author}
                      onChange={(e) => update({ author: e.target.value })}
                    />
                  </label>
                  <label>
                    License
                    <input
                      value={skill.license}
                      onChange={(e) => update({ license: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  {t("标签 · 逗号分隔", "Tags · comma separated")}
                  <input
                    value={skill.tags.join(", ")}
                    onChange={(e) =>
                      update({
                        tags: e.target.value.split(",").map((x) => x.trim()),
                      })
                    }
                  />
                </label>
                <label>
                  {t("分类", "Category")}
                  <Pick
                    label="Category"
                    value={skill.category}
                    onChange={(v) => update({ category: v })}
                    items={[
                      "Coding",
                      "GitHub",
                      "Research",
                      "Writing",
                      "Data",
                      "DevOps",
                      "Frontend",
                      "Backend",
                      "Testing",
                      "Documentation",
                      "Productivity",
                      "Education",
                    ]}
                  />
                </label>
                <label>
                  {t(
                    "兼容目标 · 逗号分隔",
                    "Compatibility targets · comma separated",
                  )}
                  <input
                    value={skill.compatibility.join(", ")}
                    onChange={(e) =>
                      update({
                        compatibility: e.target.value
                          .split(",")
                          .map((x) => x.trim()),
                      })
                    }
                  />
                </label>
                <h3>{t("工具权限", "Tool permissions")}</h3>
                {skill.tools.map((tool, i) => (
                  <div className="nested-form" key={i}>
                    {(["name", "permissions", "description"] as const).map(
                      (k) => (
                        <label key={k}>
                          {k}
                          <input
                            value={tool[k]}
                            onChange={(e) =>
                              update({
                                tools: skill.tools.map((v, j) =>
                                  j === i ? { ...v, [k]: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                    <button
                      className="text-button"
                      onClick={() =>
                        update({ tools: skill.tools.filter((_, j) => j !== i) })
                      }
                    >
                      {t("移除工具", "Remove tool")}
                    </button>
                  </div>
                ))}
                <button
                  className="secondary"
                  onClick={() =>
                    update({
                      tools: [
                        ...skill.tools,
                        {
                          name: "read_files",
                          permissions: "Read-only user-supplied files",
                          description: "",
                        },
                      ],
                    })
                  }
                >
                  {t("添加工具", "Add tool")}
                </button>
                <h3>{t("输入输出示例", "Examples")}</h3>
                {skill.examples.map((ex, i) => (
                  <div className="nested-form" key={i}>
                    <label>
                      Input
                      <textarea
                        value={ex.input}
                        onChange={(e) =>
                          update({
                            examples: skill.examples.map((x, j) =>
                              i === j ? { ...x, input: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Output
                      <textarea
                        value={ex.output}
                        onChange={(e) =>
                          update({
                            examples: skill.examples.map((x, j) =>
                              i === j ? { ...x, output: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      className="text-button"
                      onClick={() =>
                        update({
                          examples: skill.examples.filter((_, j) => j !== i),
                        })
                      }
                    >
                      {t("移除示例", "Remove example")}
                    </button>
                  </div>
                ))}
                <button
                  className="secondary"
                  onClick={() =>
                    update({
                      examples: [...skill.examples, { input: "", output: "" }],
                    })
                  }
                >
                  {t("添加示例", "Add example")}
                </button>
              </div>
            </TabsContent>
            <TabsContent value="code">
              <div className="code-controls">
                <span className="mono">{file}</span>
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      applyCode(
                        file.endsWith(".json")
                          ? JSON.stringify(JSON.parse(code), null, 2)
                          : skillMarkdown(skill),
                      );
                    } catch {
                      toast.error("Invalid JSON");
                    }
                  }}
                >
                  {t("格式化", "Format")}
                </button>
                <div className="search-field">
                  <Search size={13} />
                  <input
                    aria-label="Find in editor"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("查找", "Find")}
                  />
                  <button
                    onClick={() => {
                      const pos = code
                        .toLowerCase()
                        .indexOf(
                          search.toLowerCase(),
                          input.current?.selectionEnd ?? 0,
                        );
                      const next =
                        pos < 0
                          ? code.toLowerCase().indexOf(search.toLowerCase())
                          : pos;
                      input.current?.focus();
                      input.current?.setSelectionRange(
                        next,
                        next + search.length,
                      );
                    }}
                  >
                    ↵
                  </button>
                </div>
              </div>
              <textarea
                ref={input}
                className="code-editor"
                value={code}
                readOnly={file === "README.md"}
                spellCheck={false}
                aria-label="Code editor"
                onChange={(e) => applyCode(e.target.value)}
              />
              {error && <pre className="validation-error">{error}</pre>}
            </TabsContent>
            <TabsContent value="preview">
              <div className="markdown-preview">
                {skillMarkdown(skill)
                  .split("\n")
                  .map((line, i) =>
                    line.startsWith("# ") ? (
                      <h1 key={i}>{line.slice(2)}</h1>
                    ) : line.startsWith("## ") ? (
                      <h2 key={i}>{line.slice(3)}</h2>
                    ) : (
                      <p key={i}>{line || "\u00a0"}</p>
                    ),
                  )}
              </div>
            </TabsContent>
            <TabsContent value="inspector">
              <Inspector skill={skill} lang={lang} />
            </TabsContent>
          </Tabs>
          {detectSecrets(JSON.stringify(skill)).length > 0 && (
            <div className="secret-banner">
              Potential Secret Detected{" "}
              <button
                onClick={() => {
                  try {
                    update(JSON.parse(redactSecrets(JSON.stringify(skill))));
                    toast.success(
                      t("已遮盖疑似敏感值", "Potential secrets redacted"),
                    );
                  } catch {
                    toast.error(
                      t(
                        "请在表单中手动移除敏感值",
                        "Remove the secret in the form",
                      ),
                    );
                  }
                }}
              >
                {t("遮盖敏感值", "Redact")}
              </button>
            </div>
          )}
        </section>
        <div className="desktop-inspector">
          <Inspector skill={skill} lang={lang} />
        </div>
      </div>
    </div>
  );
}
