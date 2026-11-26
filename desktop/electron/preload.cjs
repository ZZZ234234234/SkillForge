// 预加载脚本：只向页面暴露一组受限的异步方法，不开放 Node 能力。
const { contextBridge, ipcRenderer } = require("electron");

const call = (channel) => async (payload) => {
  const r = await ipcRenderer.invoke(channel, payload);
  if (!r || typeof r !== "object" || !r.ok)
    throw new Error((r && r.error) || "桌面端调用失败");
  return r.data;
};

// 页面按参数调用；主进程按名字段的对象接收，这里负责对应
const api = {
  env: call("env"),
  roots: call("roots"),
  addRoot: call("roots:add"),
  removeRoot: (id) => call("roots:remove")({ id }),
  scan: call("scan"),
  read: (paths) => call("read")({ paths }),
  installs: call("installs"),
  install: call("install"),
  uninstall: call("uninstall"),
  showItem: call("show"),
  openFile: call("open"),
  openExternal: call("open-external"),
  storageRead: (key) => call("storage:read")({ key }),
  storageWrite: (key, value) => call("storage:write")({ key, value }),
  onScan(callback) {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("scan:changed", handler);
    return () => ipcRenderer.removeListener("scan:changed", handler);
  },
};

contextBridge.exposeInMainWorld("skillforgeDesktop", Object.freeze(api));
