// 自动化验证：在隔离的主目录里跑一遍“扫描 → 导入 → 磁盘变化自动刷新 → 安装 → 覆盖安装 → 卸载”，
// 再检查几条安全边界。由主进程在 --smoke 模式下调用，结果写到报告文件。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const fsp = fs.promises;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSmoke({ win, out, home }) {
  const checks = [];
  const dir = path.dirname(out);
  await fsp.mkdir(dir, { recursive: true });
  const shot = (name) => path.join(dir, `smoke-${name}.png`);

  // 页面的报错写进报告，方便定位界面问题
  const logs = [];
  win().webContents.on("console-message", (e) => {
    if (e.level === "error" && logs.length < 200)
      logs.push(`${e.message} (${path.basename(e.sourceId)}:${e.lineNumber})`);
  });
  win().webContents.on("render-process-gone", (_e, details) =>
    logs.push(`render process gone: ${details.reason}`),
  );
  win().webContents.session.webRequest.onCompleted(
    { urls: ["app://skillforge/*"] },
    (d) => {
      if (d.statusCode >= 400) logs.push(`HTTP ${d.statusCode} ${d.url}`);
    },
  );

  const check = (name, ok, detail = "") => {
    checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "").slice(0, 600) });
    if (!ok) console.error(`[smoke] FAIL ${name} ${detail}`);
  };

  /** 在页面里执行一段脚本；失败按未通过处理，不让整轮验证中断。 */
  const js = async (body) => {
    try {
      return await win().webContents.executeJavaScript(body, true);
    } catch (e) {
      return { __error: e instanceof Error ? e.message : String(e) };
    }
  };
  const waitFor = async (label, body, timeout = 20_000) => {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
      last = await js(body);
      if (last && last.ok) return last;
      await sleep(250);
    }
    return last ?? { ok: false, why: `timeout: ${label}` };
  };
  /** 隐藏窗口的画面更新有延迟：等到截到与上一张不同的画面再保存 */
  let lastFrame = "";
  const snap = async (name) => {
    try {
      let saved = false;
      let buf = null;
      for (let i = 0; i < 12 && !saved; i++) {
        await sleep(300);
        // 等界面真正画出新的一帧再截
        await js(
          `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => ({ ok: true }), () => ({ ok: false }))`,
        ).catch(() => null);
        buf = await win().webContents.capturePage().then((img) => img.toPNG());
        const hash = crypto.createHash("sha1").update(buf).digest("hex");
        if (hash === lastFrame) continue; // 还是上一张画面
        saved = true;
        lastFrame = hash;
      }
      // 画面确实没变时也保存最后一张
      await fsp.writeFile(shot(name), buf);
      return saved;
    } catch (e) {
      check("截图 " + name, false, e.message);
      return false;
    }
  };

  /** 在页面里点击匹配到的第一个元素 */
  const clickIn = (selectorExpr) => js(`(() => {
    const el = ${selectorExpr};
    if (!el) return { ok: false, why: "not found" };
    el.scrollIntoView({ block: "center" });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return { ok: true, text: (el.textContent || "").trim().slice(0, 120) };
  })()`);

  // 某个 Agent 目录下的某一行技能
  const rowExpr = (name, rootId) =>
    `[...document.querySelectorAll('[data-local-item="${name}"]')].find((r) =>
      (r.querySelector('.sf-local-origin')?.textContent || '').includes(${JSON.stringify(
        rootId,
      )}))`;

  await new Promise((resolve) => {
    const w = win();
    if (w.webContents.isLoading()) w.webContents.once("did-finish-load", resolve);
    else resolve();
  });

  // 1. 界面与首扫
  const ready = await waitFor(
    "local view scanned",
    `(() => {
      const v = document.querySelector('[data-local-view]');
      const s = document.querySelector('[data-local-status]')?.textContent || '';
      const roots = document.querySelectorAll('[data-root]').length;
      return v && !s.includes('扫描中') && !s.includes('Scanning') && roots >= 7
        ? { ok: true, status: s.trim(), roots }
        : { ok: false, why: s.trim(), roots };
    })()`,
    30_000,
  );
  check("界面加载并完成首次扫描", ready.ok, JSON.stringify(ready));
  await snap("01-scan");

  const listed = await js(`(() => {
    const names = [...document.querySelectorAll('[data-local-item]')].map((e) => e.getAttribute('data-local-item'));
    return { ok: true, names };
  })()`);
  check("发现技能文件夹、平铺文件和分组目录", 
    ["alpha-notes", "flat-tool", "inner-skill"].every((n) => listed.names?.includes(n)),
    listed.names?.join(","));
  check("没有 SKILL.md 的文件夹不当作技能", !listed.names?.includes("broken"), listed.names?.join(","));
  const problems = await js(`document.querySelector('[data-act="problems"]')?.textContent || ""`);
  check("问题目录有提示", /broken|SKILL\.md/.test(problems), problems.trim());

  // 2. 导入到技能库
  await clickIn(rowExpr("alpha-notes", "Claude Code") + `?.querySelector('[data-act="import"]')`);
  const imported = await waitFor(
    "imported",
    `(() => { const r = ${rowExpr("alpha-notes", "Claude Code")};
      return r?.getAttribute('data-state') === 'in-sync' && r.querySelector('[data-flag="linked"]')
        ? { ok: true } : { ok: false, why: r?.getAttribute('data-state') }; })()`,
  );
  check("导入本机技能后显示“已在技能库”", imported.ok, imported.why);
  await snap("02-imported");

  // 3. 磁盘改动 → 自动刷新，技能库跟着更新
  const skillMd = path.join(home, ".claude", "skills", "alpha-notes", "SKILL.md");
  const disk = await fsp.readFile(skillMd, "utf8");
  await fsp.writeFile(skillMd, disk.replace("Original description", "Edited on disk"));
  const followed = await waitFor(
    "auto refresh",
    `(() => { const r = ${rowExpr("alpha-notes", "Claude Code")};
      const d = r?.querySelector('.sf-local-desc')?.textContent || '';
      return d.includes('Edited on disk') && r.getAttribute('data-state') === 'in-sync'
        ? { ok: true } : { ok: false, why: d }; })()`,
    20_000,
  );
  check("磁盘文件改动后自动刷新并跟进", followed.ok, followed.why);
  await snap("03-auto-refresh");

  // 4. 安装到尚不存在的 Agent 目录（复制整个文件夹）
  await clickIn(rowExpr("alpha-notes", "Claude Code") + `?.querySelector('[data-act="install"]')`);
  const dialog = await waitFor("install dialog", `document.querySelector('[data-install-dialog]') ? { ok: true } : { ok: false }`);
  check("弹出安装目录选择", dialog.ok, dialog.why);
  const title = await js(`document.querySelector('[data-install-dialog] h2')?.textContent || ""`);
  check("弹窗标题里是技能名", title.includes("alpha-notes"), title);
  const self = await js(`Boolean(document.querySelector('[data-install-target="claude"]'))`);
  check("不能装回技能自己所在的目录", self === false, self);
  await clickIn(`document.querySelector('[data-install-target="copilot"] input')`);
  await clickIn(`document.querySelector('[data-install-confirm]')`);
  const installed = await waitFor(
    "installed",
    `(() => { const r = ${rowExpr("alpha-notes", "Claude Code")};
      const flag = r?.querySelector('[data-flag="installed"]')?.textContent || '';
      return flag.includes('GitHub Copilot') && !document.querySelector('[data-install-dialog]')
        ? { ok: true } : { ok: false, why: flag }; })()`,
  );
  check("安装后显示“已安装到 GitHub Copilot”", installed.ok, installed.why);
  const copied = [
    path.join(home, ".copilot", "skills", "alpha-notes", "SKILL.md"),
    path.join(home, ".copilot", "skills", "alpha-notes", "notes.txt"),
  ];
  for (const f of copied) {
    const text = await fsp.readFile(f, "utf8").catch(() => null);
    check("安装写出 " + path.basename(f), text != null, text ? text.length + " chars" : "missing");
  }
  await snap("04-installed");

  // 5. 目标目录已有同名技能：先提示，确认后才覆盖，其他文件保持不动
  const kept = path.join(home, ".cursor", "skills", "alpha-notes", "mine.txt");
  await clickIn(rowExpr("alpha-notes", "Claude Code") + `?.querySelector('[data-act="install"]')`);
  await clickIn(`document.querySelector('[data-install-target="cursor"] input')`);
  await clickIn(`document.querySelector('[data-install-confirm]')`);
  const conflict = await waitFor(
    "conflict prompt",
    `document.querySelector('[data-install-conflicts]') ? { ok: true, n: document.querySelector('[data-install-conflicts]').getAttribute('data-install-conflicts') } : { ok: false }`,
  );
  check("目标已有同名文件时先提示", conflict.ok, JSON.stringify(conflict));
  const beforeOverwrite = await fsp.readFile(
    path.join(home, ".cursor", "skills", "alpha-notes", "SKILL.md"),
    "utf8",
  );
  check("提示期间不改动已有文件", beforeOverwrite.includes("existing skill"), beforeOverwrite.slice(0, 80));
  await snap("05-conflict");
  await clickIn(`document.querySelector('[data-install-confirm="overwrite"]')`);
  await waitFor("overwritten", `!document.querySelector('[data-install-dialog]') ? { ok: true } : { ok: false }`);
  const afterOverwrite = await fsp.readFile(
    path.join(home, ".cursor", "skills", "alpha-notes", "SKILL.md"),
    "utf8",
  );
  check("确认后覆盖同名文件", afterOverwrite.includes("Edited on disk"), afterOverwrite.slice(0, 80));
  check("目标目录里不属于本次安装的文件不被改动", (await fsp.readFile(kept, "utf8")) === "keep me");

  // 6. 技能库生成的文件也能安装
  const fromLib = await js(`window.skillforgeDesktop.install({
    rootId: "copilot", name: "lib-made",
    files: { "SKILL.md": ${JSON.stringify(
      "---\nname: lib-made\ndescription: Made in the library\n---\n\n# lib-made\n",
    )}, "skill.json": "{}" },
    skillId: "smoke-lib" })`);
  check("安装技能库里的技能（写入文件）", fromLib?.status === "ok", JSON.stringify(fromLib));
  check(
    "技能库技能落盘",
    (await fsp.readFile(path.join(home, ".copilot", "skills", "lib-made", "SKILL.md"), "utf8").catch(() => ""))
      .includes("Made in the library"),
  );

  // 7. 卸载：只移除 SkillForge 写入的文件
  await clickIn(
    `[...document.querySelectorAll('[data-flag="installed"]')].find((f) => f.textContent.includes('GitHub Copilot') && !f.textContent.includes('lib-made'))?.querySelector('.sf-flag-x')`,
  );
  await clickIn(`document.querySelector('[data-act="uninstall"]')`);
  const uninstalled = await waitFor(
    "uninstalled",
    `(() => { const flags = ${rowExpr("alpha-notes", "Claude Code")}?.querySelectorAll('[data-flag="installed"]') ?? [];
      return ![...flags].some((f) => f.textContent.includes('GitHub Copilot'))
        ? { ok: true } : { ok: false, why: [...flags].map((f) => f.textContent).join('|') }; })()`,
  );
  check("卸载后“已安装”标记消失", uninstalled.ok, uninstalled.why);
  check("卸载后写入的文件被移除", !(await fsp.stat(copied[0]).catch(() => null)));

  // 8. 安全边界（断言具体的拒绝原因，而不是“只要报错就算过”）
  const guard = await js(`(async () => {
    const d = window.skillforgeDesktop;
    const err = (p) => p.then(() => "", (e) => e.message);
    return {
      node: typeof window.require === "undefined",
      builtinRoot: await err(d.removeRoot("claude")),
      outsideRead: (await d.read([${JSON.stringify(path.join(home, "outside.txt"))}]))[0],
      badKey: await err(d.storageRead("../x")),
      badName: await err(d.install({ rootId: "copilot", name: "../escape", files: { "SKILL.md": "x" } })),
      badFile: await err(d.install({ rootId: "copilot", name: "ok-name", files: { "../../x.md": "x" } })),
    };
  })()`);
  check("页面拿不到 Node 能力", guard.node === true, guard.node);
  check("内置目录不能被移除", guard.builtinRoot === "内置目录不能移除", guard.builtinRoot);
  check(
    "不读取技能目录以外的文件",
    guard.outsideRead?.text === null && guard.outsideRead?.error === "Outside skill folders",
    JSON.stringify(guard.outsideRead),
  );
  check("非法存档名被拒绝", /存档名/.test(guard.badKey ?? ""), guard.badKey);
  check("非法技能名被拒绝", Boolean(guard.badName), guard.badName);
  check("越界的相对路径被拒绝", Boolean(guard.badFile), guard.badFile);
  check(
    "越界文件没有落盘",
    !fs.existsSync(path.join(home, ".copilot", "skills", "..", "..", "..", "x.md")) &&
      !fs.existsSync(path.join(home, "x.md")),
  );

  const stored = await js(
    `window.skillforgeDesktop.storageRead("skillforge-local-v1").then((d) => (d?.skills ?? []).map((s) => s.name))`,
  );
  check("技能库写在本机文件里", Array.isArray(stored) && stored.includes("alpha-notes"), JSON.stringify(stored));

  await snap("06-final");
  const ok = checks.every((c) => c.ok);
  await fsp.writeFile(out, JSON.stringify({ ok, at: new Date().toISOString(), checks, logs }, null, 2));
  for (const l of logs.slice(0, 15)) console.log("[page] " + l);
  console.log(`[smoke] ${checks.filter((c) => c.ok).length}/${checks.length} passed`);
  app.quit();
}

/**
 * 只读快照（--snapshot=<out.png>）：对着真实目录扫描一次，截两张图并写一份统计后退出。
 * 不点击任何按钮，也不调用安装；应用数据放在临时目录。
 */
export async function runSnapshot({ win, out }) {
  const wc = win().webContents;
  const logs = [];
  wc.on("console-message", (e) => {
    if (e.level === "error" && logs.length < 100) logs.push(e.message);
  });
  await new Promise((resolve) => {
    if (wc.isLoading()) wc.once("did-finish-load", resolve);
    else resolve();
  });
  const end = Date.now() + 120_000;
  let stats = null;
  const started = Date.now();
  while (Date.now() < end) {
    try {
      stats = await wc.executeJavaScript(
        `(() => {
          const roots = document.querySelectorAll('[data-root]').length;
          const alert = document.querySelector('[role="alert"]')?.textContent.trim() ?? '';
          const pageError = document.body.innerText.includes('Unable to read saved data');
          // 首次扫描完成（目录列表出现）或出现错误之前都继续等
          if (roots < 7 && !alert && !pageError) return null;
          const s = document.querySelector('[data-local-status]')?.textContent || '';
          return {
            status: s.trim(),
            roots: [...document.querySelectorAll('[data-root]')].map((r) => r.querySelector('.sf-local-root-name')?.textContent.trim().replace(/\\s+/g, ' ') + ' | ' + r.querySelector('.sf-local-state')?.textContent.trim()),
            rows: document.querySelectorAll('[data-local-item]').length,
            problems: document.querySelector('[data-act="problems"]')?.textContent.trim() ?? '',
            alert,
            pageError,
          };
        })()`,
        true,
      );
    } catch (e) {
      stats = { error: e.message };
      break;
    }
    if (stats) break;
    await sleep(400);
  }
  console.log(`[snapshot] scan settled after ${Date.now() - started} ms`);
  let lastFrame = "";
  const capture = async (file) => {
    let buf = null;
    for (let i = 0; i < 12; i++) {
      await sleep(300);
      // 隐藏窗口的画面有延迟：等新的一帧，并且与上一张不同
      await wc
        .executeJavaScript(
          `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => true)`,
          true,
        )
        .catch(() => null);
      buf = await wc.capturePage().then((img) => img.toPNG());
      const hash = crypto.createHash("sha1").update(buf).digest("hex");
      if (hash !== lastFrame) {
        lastFrame = hash;
        break;
      }
    }
    await fsp.writeFile(file, buf);
  };
  const base = out.replace(/\.png$/i, "");
  await fsp.mkdir(path.dirname(out), { recursive: true });
  await capture(base + "-top.png");
  await wc
    .executeJavaScript(`document.querySelector('.sf-local-list')?.scrollIntoView(); true`, true)
    .catch(() => null);
  await sleep(600);
  await capture(base + "-list.png");
  const summary = { at: new Date().toISOString(), stats, logs };
  await fsp.writeFile(base + ".json", JSON.stringify(summary, null, 2));
  console.log("[snapshot] " + JSON.stringify({ rows: stats?.rows, roots: stats?.roots?.length, alert: stats?.alert }));
  app.quit();
}
