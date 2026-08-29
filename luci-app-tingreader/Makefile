include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-tingreader
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

LUCI_TITLE:=LuCI support for Ting Reader
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode +tingreader
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
