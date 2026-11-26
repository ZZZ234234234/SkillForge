/**
 * 桌面版入口：与网页版共用同一个 SkillForge 组件，
 * 只是不经过 Next 的服务端渲染，直接在应用窗口里挂载。
 */
import { createRoot } from "react-dom/client";
import SkillForge from "../../src/components/skillforge";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<SkillForge />);
