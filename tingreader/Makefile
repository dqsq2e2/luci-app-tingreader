TINGREADER_PACKAGE_DIR:=$(dir $(abspath $(lastword $(MAKEFILE_LIST))))

include $(TOPDIR)/rules.mk

include $(TINGREADER_PACKAGE_DIR)../version.mk

PKG_NAME:=tingreader
PKG_VERSION:=$(TINGREADER_VERSION)
PKG_RELEASE:=1
PKG_FLAGS:=nonshared

PKG_LICENSE:=AGPL-3.0-only
PKG_MAINTAINER:=Ting Reader contributors
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)-$(ARCH)

# Backend binaries are built natively from source by .github/workflows/build-backend.yml
TINGREADER_BACKEND_RELEASE_URL:=https://github.com/dqsq2e2/luci-app-tingreader/releases/download/backend-v$(PKG_VERSION)
TINGREADER_FRONTEND_RELEASE_URL:=https://github.com/dqsq2e2/ting-reader/releases/download/v$(PKG_VERSION)
FRONTEND_FILE:=ting-reader-frontend-$(PKG_VERSION).tar.gz

ifneq ($(filter x86_64%,$(ARCH)),)
  APP_ARCH:=amd64
  BACKEND_HASH:=$(TINGREADER_BACKEND_AMD64_HASH)
endif

ifneq ($(filter aarch64% arm64%,$(ARCH)),)
  APP_ARCH:=arm64
  BACKEND_HASH:=$(TINGREADER_BACKEND_ARM64_HASH)
endif

BACKEND_FILE:=ting-reader-backend-linux-$(APP_ARCH)-$(PKG_VERSION).tar.gz

PKG_SOURCE:=$(BACKEND_FILE)
PKG_SOURCE_URL:=$(TINGREADER_BACKEND_RELEASE_URL)
PKG_HASH:=$(BACKEND_HASH)

include $(INCLUDE_DIR)/package.mk

RSTRIP:=:

define Download/tingreader-frontend
  FILE:=$(FRONTEND_FILE)
  URL:=$(TINGREADER_FRONTEND_RELEASE_URL)
  HASH:=$(TINGREADER_FRONTEND_HASH)
endef
$(eval $(call Download,tingreader-frontend))

define Package/tingreader
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=Ting Reader audiobook server
  URL:=https://github.com/dqsq2e2/ting-reader
  DEPENDS:=+ca-bundle
  USERID:=tingreader=32771:tingreader=32771
  PKG_FLAGS:=nonshared
endef

define Package/tingreader/description
  Ting Reader is a self-hosted audiobook server. This package carries the
  natively built backend with isolated glibc runtime libraries.
endef

define Package/tingreader/conffiles
/etc/config/tingreader
endef

define Build/Prepare
	rm -rf $(PKG_BUILD_DIR)
	mkdir -p $(PKG_BUILD_DIR)
	tar -xzf $(DL_DIR)/$(BACKEND_FILE)  -C $(PKG_BUILD_DIR)
	tar -xzf $(DL_DIR)/$(FRONTEND_FILE) -C $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/tingreader/install
	$(INSTALL_DIR) $(1)/usr/lib/tingreader/runtime
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/ting-reader        $(1)/usr/lib/tingreader/ting-reader
	if [ -d $(PKG_BUILD_DIR)/static ]; then \
		$(CP) $(PKG_BUILD_DIR)/static $(1)/usr/lib/tingreader/; \
	fi
	$(INSTALL_DIR) $(1)/usr/lib/tingreader/preinstalled-plugins
	if [ -d $(PKG_BUILD_DIR)/preinstalled-plugins ]; then \
		$(CP) $(PKG_BUILD_DIR)/preinstalled-plugins/. $(1)/usr/lib/tingreader/preinstalled-plugins/; \
	fi
	if [ -d $(PKG_BUILD_DIR)/runtime ]; then \
		$(CP) $(PKG_BUILD_DIR)/runtime/. $(1)/usr/lib/tingreader/runtime/; \
	fi

	$(INSTALL_DIR) $(1)/usr/bin $(1)/usr/libexec $(1)/etc/init.d $(1)/etc/config
	$(INSTALL_BIN) ./files/usr/bin/ting-reader $(1)/usr/bin/ting-reader
	$(INSTALL_BIN) ./files/usr/libexec/tingreader-generate-config \
		$(1)/usr/libexec/tingreader-generate-config
	$(INSTALL_BIN) ./files/usr/libexec/tingreader-read-log \
		$(1)/usr/libexec/tingreader-read-log
	$(INSTALL_BIN) ./files/etc/init.d/tingreader $(1)/etc/init.d/tingreader
	$(INSTALL_CONF) ./files/etc/config/tingreader $(1)/etc/config/tingreader

	$(INSTALL_DIR) $(1)/usr/share/tingreader
	echo '$(PKG_VERSION)' > $(1)/usr/share/tingreader/version
endef

define Package/tingreader/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /etc/init.d/tingreader enable
exit 0
endef

$(eval $(call BuildPackage,tingreader))
