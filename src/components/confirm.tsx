"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConfirmFn, ConfirmRequest } from "../types/agent";
import type { Language } from "../types/skill";
import { words } from "./controls";
type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };
/**
 * 权限确认：写入 / 联网工具每次调用前弹出，等用户选择后再继续 Agent 循环。
 * 关闭弹窗等同拒绝；组件卸载时把挂起的请求全部拒绝，避免循环卡住。
 */
export function useConfirm(lang: Language) {
  const t = words(lang);
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<Pending | null>(null);
  const confirm = useCallback<ConfirmFn>(
    (request) =>
      new Promise<boolean>((resolve) => {
        // 同一时刻只会有一个挂起请求（循环是顺序执行的）
        ref.current?.resolve(false);
        const p = { ...request, resolve };
        ref.current = p;
        setPending(p);
      }),
    [],
  );
  const answer = useCallback((ok: boolean) => {
    ref.current?.resolve(ok);
    ref.current = null;
    setPending(null);
  }, []);
  // 组件卸载（切换页面）时拒绝挂起的请求，循环才能结束
  useEffect(
    () => () => {
      ref.current?.resolve(false);
      ref.current = null;
    },
    [],
  );
  const kindLabel = {
    write: t("写入", "write"),
    network: t("联网", "network"),
    read: t("读取", "read"),
  };
  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(v) => !v && answer(false)}>
      <DialogContent className="confirm-dialog">
        <DialogHeader>
          <DialogTitle>
            <ShieldAlert size={18} />{" "}
            {t("Agent 请求一次", "The agent requests a")}{" "}
            {pending ? kindLabel[pending.kind] : ""} {t("操作", "operation")}
          </DialogTitle>
          <DialogDescription>
            {pending?.kind === "network"
              ? t(
                  "这会从你的浏览器直接访问外部网址，内容会经过你配置的模型服务商。",
                  "This fetches an external URL from your browser; the content then goes to your model provider.",
                )
              : t(
                  "这会改变技能库或本次运行的产出文件。请核对工具与参数后再决定。",
                  "This changes the skill library or this run's output. Review the tool and arguments first.",
                )}
          </DialogDescription>
        </DialogHeader>
        <pre className="confirm-args">
          {pending ? `${pending.tool}(${pending.args})` : ""}
        </pre>
        <DialogFooter>
          <button className="secondary" onClick={() => answer(false)}>
            {t("拒绝", "Deny")}
          </button>
          <button className="primary" onClick={() => answer(true)}>
            {t("允许这一次", "Allow once")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { confirm, dialog, pending };
}
