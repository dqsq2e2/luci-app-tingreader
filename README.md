# luci-app-tingreader

Ting Reader（听悦）的官方 OpenWrt 软件包项目，包含服务端核心包、现代 LuCI 管理界面，以及自动化 IPK/APK GitHub Actions 构建流程。

---

## 🌟 核心特性

- **现代 LuCI 界面**：基于 JavaScript / ucode 开发，提供平滑美观的状态展示与操作体验。
- **实时监控与控制**：实时展示服务运行状态、PID、CPU 与内存占用；支持「打开 Ting Reader」「重启服务」「查看实时日志」。
- **双标签日志查看器**：支持在弹窗中无刷新查看「系统运行日志」与「应用核心日志（自动轮转）」，方便排障。
- **降权安全运行**：后端主程序以普通非 root 系统用户 `tingreader:tingreader`（UID `32771`）运行，保障路由器系统安全。
- **FPK 规范数据架构**：遵循与飞牛 FPK 一致的规范目录设计，主数据目录下的 `data/` 子目录集中管理数据库（WAL 模式）、插件、日志与转码缓存，默认媒体位于 `storage/`。
- **智能磁盘识别与去重**：数据目录下拉菜单自动识别外接 NVMe / SATA 硬盘物理根挂载点并过滤冗余子挂载，防止误写满路由器内置 Flash 闪存。
- **本地存储库路径授权**：支持添加多个外置磁盘路径，服务启动时自动赋予读写权限，无需手动在后台执行 `chown`/`chmod`。
- **守护进程自动管理**：使用 OpenWrt procd 服务守护，配置变更后自动平滑重载。

---

## 📦 软件包结构与架构支持

### 软件包组成
| 软件包 | 说明 |
| :--- | :--- |
| **`tingreader`** | 服务端静态二进制、前端静态资源、预置插件、procd 守护脚本与 UCI 配置 |
| **`luci-app-tingreader`** | LuCI 管理界面、RPC 接口与访问控制 |
| **`luci-i18n-tingreader-zh-cn`** | 简体中文语言包 |

### 支持的系统与硬件架构
- **OpenWrt 版本**：
  - **OpenWrt 25.12.x+**：基于 APK 包管理器，提供标准 `.apk` 软件包。
  - **OpenWrt 24.10.x**：基于 opkg 包管理器，提供标准 `.ipk` 软件包。
- **硬件架构覆盖**：
  - `x86_64`
  - `aarch64_generic` / `aarch64_cortex-a53` / `aarch64_cortex-a72` / `aarch64_cortex-a76`

> 后端采用纯静态链接构建（musl / 静态 OpenSSL），无需携带私有 glibc，原生适配所有标准 OpenWrt 系统。

---

## 🚀 安装与使用

### 1. 手动安装下载的软件包

从 [Releases 发布页面](https://github.com/dqsq2e2/luci-app-tingreader/releases) 下载对应架构与系统版本的压缩包，解压后上传并安装：

```sh
# opkg (OpenWrt 24.10 / IPK)
opkg install ./tingreader_*.ipk
opkg install ./luci-app-tingreader_*.ipk
opkg install ./luci-i18n-tingreader-zh-cn_*.ipk

# apk (OpenWrt 25.12+ / APK)
apk add --allow-untrusted ./tingreader_*.apk
apk add --allow-untrusted ./luci-app-tingreader_*.apk
apk add --allow-untrusted ./luci-i18n-tingreader-zh-cn_*.apk
```

### 2. 配置与启动

1. 进入 LuCI Web 界面「服务 -> Ting Reader」。
2. 勾选「启用」，设置监听端口（默认 `3000`）。
3. **选择数据目录**：建议在下拉菜单中选择外挂的物理硬盘根路径（例如 `/mnt/nvme/tingreader`）。
4. **配置本地存储库授权路径**：
   - 首次启动若未配置，系统会自动将默认媒体存储目录（`$data_dir/storage`）添加至授权列表。
   - 若你的有声书存放在其他外接硬盘目录（如 `/mnt/sda1/audiobooks`），在列表中点击「添加」填入该路径即可。
5. 点击「保存并应用」，即可通过 `http://路由器IP:3000` 开始畅享听书！

---

## 🛠️ 作为 feeds 源码编译

在 OpenWrt 源码根目录的 `feeds.conf.default` 中添加：

```text
src-git tingreader https://github.com/dqsq2e2/luci-app-tingreader.git
```

然后执行更新与安装：

```sh
./scripts/feeds update tingreader
./scripts/feeds install -a -p tingreader
make menuconfig
```

在 `Multimedia` 中勾选 `tingreader`，并在 `LuCI -> Applications` 中勾选 `luci-app-tingreader`。

单包独立编译命令：

```sh
make package/tingreader/compile V=s
make package/luci-app-tingreader/compile V=s
```

---

## 📂 核心路径一览

- **UCI 配置文件**：`/etc/config/tingreader`
- **动态生成配置**：`/var/etc/tingreader.toml`
- **系统数据目录**：`$data_dir/data/`（包含数据库 `ting-reader.db`、日志 `logs/`、插件 `plugins/` 与缓存 `tmp/`）
- **默认媒体存储**：`$data_dir/storage/`
- **程序安装目录**：`/usr/lib/tingreader`
- **系统服务控制**：`/etc/init.d/tingreader {start|stop|restart|status}`

---

## 🔄 上游版本同步与自动化

`version.mk` 锁定了上游 Ting Reader 正式版本号及各架构二进制的 SHA-256 校验值。

本仓库通过 GitHub Actions 实现了：
1. **自动监听主仓发版**：通过 `repository_dispatch` 与定时轮询，自动捕获上游发布并完成原生编译；
2. **多架构全自动发版**：自动产出全架构 IPK / APK 并发布 Release；
3. **CI 历史自动滚动清理**：工作流结束后自动清理过期的运行记录与构建缓存，保持仓库清爽。

