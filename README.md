# luci-app-tingreader

Ting Reader 的 OpenWrt 软件包项目，包含服务端核心包、现代 LuCI 管理界面，以及 IPK/APK GitHub Actions 构建流程。

## 功能

- 显示运行状态、PID、CPU 和内存占用。
- 提供“打开 Ting Reader”“重启”“查看日志”操作。
- 日志弹窗包含系统日志和插件日志两个 tab，显示 Ting Reader 原始 JSON 日志及轮转文件。
- 支持启用开关、监听地址、监听端口配置。
- 支持添加、删除、启用、排序多个本地存储库。
- 使用 procd 守护进程，并在 UCI 配置变化后自动重载服务。

## 支持范围

- CPU：`x86_64`、`aarch64`。
- LuCI：使用 JS/ucode 的现代 LuCI，建议 OpenWrt 24.10 或更新版本。
- 软件包格式：OpenWrt 24.10.8 SDK 构建 IPK，OpenWrt 25.12.5 SDK 构建 APK。

官方 Linux 后端是 glibc 动态链接程序，而常见 OpenWrt 固件使用 musl。本项目会在 `tingreader` 包内加入仅供 Ting Reader 使用的 Debian Bookworm GNU/OpenSSL 运行时，并通过私有 loader 启动，不会替换系统 libc。

## 软件包

| 包名 | 说明 |
| --- | --- |
| `tingreader` | 官方后端、前端、预装插件、私有运行时、procd 服务和 UCI 配置 |
| `luci-app-tingreader` | LuCI 页面、RPC 接口和访问控制 |
| `luci-i18n-tingreader-zh-cn` | 简体中文翻译，由 LuCI 构建系统自动生成 |

手动安装时请使用同一架构和同一包管理器生成的文件：

```sh
# opkg / IPK
opkg install ./tingreader_*.ipk
opkg install ./luci-app-tingreader_*.ipk
opkg install ./luci-i18n-tingreader-zh-cn_*.ipk

# apk / APK
apk add --allow-untrusted ./tingreader_*.apk
apk add --allow-untrusted ./luci-app-tingreader_*.apk
apk add --allow-untrusted ./luci-i18n-tingreader-zh-cn_*.apk
```

安装后进入 LuCI 的“服务 -> Ting Reader”。首次启动前请确认存储库路径位于容量充足的磁盘上。

## 作为 feeds 编译

在 OpenWrt 源码树的 `feeds.conf.default` 中添加：

```text
src-git tingreader https://github.com/dqsq2e2/luci-app-tingreader.git
```

然后执行：

```sh
./scripts/feeds update tingreader
./scripts/feeds install -a -p tingreader
make menuconfig
```

在 `Multimedia` 中选择 `tingreader`，并在 `LuCI -> Applications` 中选择 `luci-app-tingreader`。也可以直接把本仓库克隆到 OpenWrt 源码树的 `package/` 下再运行 `make menuconfig`。

单包编译示例：

```sh
make package/tingreader/compile V=s
make package/luci-app-tingreader/compile V=s
```

## 配置与数据

- UCI 配置：`/etc/config/tingreader`
- 生成的运行配置：`/var/etc/tingreader.toml`
- 默认数据目录：`/etc/tingreader`
- 程序目录：`/usr/lib/tingreader`

默认数据目录位于系统 overlay。大型媒体库建议通过 UCI 把 `tingreader.main.data_dir` 改到外部磁盘，并在 LuCI 中把存储库路径也指向外部磁盘：

```sh
uci set tingreader.main.data_dir='/mnt/sda1/tingreader/data'
uci commit tingreader
/etc/init.d/tingreader restart
```

## 更新上游版本

`version.mk` 固定上游版本和三个官方 release 归档的 SHA-256，以保证 feeds 构建可复现。更新到最新正式版：

```sh
./scripts/update-version.sh latest
```

工作流手动运行时默认执行同样的更新步骤，也可输入指定版本号。
