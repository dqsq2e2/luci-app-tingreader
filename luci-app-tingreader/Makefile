include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-tingreader
PKG_VERSION:=2.0.5
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

LUCI_TITLE:=LuCI support for Ting Reader
LUCI_DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode +curl +ca-bundle +jsonfilter +jshn
LUCI_PKGARCH:=all

define Package/luci-app-tingreader/conffiles
/etc/config/tingreader
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
