# luci-app-tingreader

在 OpenWrt LuCI 中安装和管理 Ting Reader（听悦）。提供服务控制、程序下载、运行状态、日志和存储目录设置。

## 安装

从 [Releases](https://github.com/dqsq2e2/luci-app-tingreader/releases/latest) 下载 IPK 或 APK 压缩包：使用 `opkg` 的系统选择 `*-ipk.zip`，使用 `apk` 的系统选择 `*-apk.zip`。每个压缩包包含 LuCI 主包与中文语言包，无需选择 CPU 架构。

解压后，在软件包所在目录执行对应命令：

```sh
# 使用 opkg 的系统
opkg update
opkg install ./luci-app-tingreader_*_all.ipk
opkg install ./luci-i18n-tingreader-zh-cn_*_all.ipk

# 使用 apk 的系统
apk update
apk add --allow-untrusted ./luci-app-tingreader-*.apk
apk add --allow-untrusted ./luci-i18n-tingreader-zh-cn-*.apk
```

安装后刷新 LuCI，进入「服务 → Ting Reader」。

## 下载程序

1. 在「程序管理」中选择版本，`latest` 表示最新已发布版本，也可以填写具体版本号。
2. 选择程序目录，建议使用允许执行程序的外置磁盘，例如 `/mnt/sda1/tingreader/program`。
3. 选择下载源：GitHub 直连、自动加速或指定加速节点。也可填写自定义 HTTPS 加速地址。
4. 点击「下载 / 更新」。前后端按同一版本下载，页面显示进度，下载过程中可取消。
5. 下载完成后，切换到「配置」标签页，选择数据目录、勾选启用，再「保存并应用」。

自动加速依次尝试预设节点，失败后尝试 GitHub 直连。自定义节点使用 `https://加速站/https://github.com/...` 形式转发 Release 下载。

后端目前支持 **x86_64 和 ARM64（aarch64）**。LuCI 的 `all` 软件包与 CPU 架构无关，实际程序按设备架构下载。支持提供 `rpcd-mod-ucode` 的 OpenWrt；发布流程分别提供 IPK 和 APK。

后端程序包含匹配的运行库、FFmpeg、FFprobe 和预装插件商店。后端从本仓库的 `backend-v*` Release 下载，Web 前端从 Ting Reader 主项目的同版本 Release 下载。

## 数据和服务

- 默认端口 `3000`，管理员初始账号 `admin`，密码 `admin123`。
- 数据目录可选择外置磁盘或填写绝对路径。
- 数据目录的 `data/` 保存数据库、插件、日志和临时文件；默认媒体目录为 `storage/`。
- 可添加多个本地存储库授权路径；首次启动未配置时自动添加默认媒体目录。
- 页面提供启动、重启、打开应用和系统/插件日志查看。
- 「配置」和「程序管理」分别使用独立标签页；顶部显示运行状态、CPU 使用率和实际内存占用。

更新程序时先下载、校验并检查运行库，再切换程序目录。下载或校验失败保留当前程序；安装失败恢复原程序。正在运行的服务会在切换时短暂停止并恢复。数据库、媒体和用户插件保存在数据目录中。

程序目录保留当前版本和上次安装的版本。更改数据目录前先停止服务，并将原数据移动到新目录。

## 从已安装的独立核心包升级

如果系统已安装 `tingreader` 软件包，先停止服务并备份 `/etc/config/tingreader`，卸载原 `luci-app-tingreader` 和 `tingreader`，再安装本页面的软件包。将备份的配置还原后，在程序管理页面下载程序，并继续使用原数据目录。

## 源码编译

在 OpenWrt 的 `feeds.conf.default` 中添加：

```text
src-git tingreader https://github.com/dqsq2e2/luci-app-tingreader.git
```

```sh
./scripts/feeds update tingreader
./scripts/feeds install -a -p tingreader
make menuconfig
make package/luci-app-tingreader/compile V=s
```

在 `LuCI → Applications` 中选择 `luci-app-tingreader`。

主项目发布新版本后，工作流原生编译 AMD64/ARM64 后端，发布程序归档及校验清单，并自动构建、发布同版本号的 LuCI 主包与中文语言包。后端使用 `backend-v版本号` 发布，LuCI 使用 `luci-v版本号` 发布，IPK/APK 包保留各自的软件包修订号。

如果后端已发布而对应 LuCI 包尚未发布，工作流会补发 LuCI 包。手动运行 LuCI 工作流时填写 `luci-v版本号` 可单独发布该版本，留空则仅构建测试产物。
