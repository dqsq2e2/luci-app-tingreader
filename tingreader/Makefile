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

GLIBC_VERSION:=2.39-0ubuntu8
LIBGCC_VERSION:=14-20240412-0ubuntu1

ifneq ($(filter x86_64%,$(ARCH)),)
  APP_ARCH:=amd64
  DEB_ARCH:=amd64
  DEB_TRIPLET:=x86_64-linux-gnu
  LOADER:=ld-linux-x86-64.so.2
  BACKEND_HASH:=$(TINGREADER_BACKEND_AMD64_HASH)
  LIBC_HASH:=af36c7ac770770fe3d3c10e85d6bc538e76e57570ba7db7d397fb9f654783ef3
  LIBGCC_HASH:=a39efdcaa2245f026dc3254ce14fcff255fc430a17064632b6ba7c5da974a912
  LIBC_URL:=http://archive.ubuntu.com/ubuntu/pool/main/g/glibc
  LIBGCC_URL:=http://archive.ubuntu.com/ubuntu/pool/main/g/gcc-14
endif

ifneq ($(filter aarch64% arm64%,$(ARCH)),)
  APP_ARCH:=arm64
  DEB_ARCH:=arm64
  DEB_TRIPLET:=aarch64-linux-gnu
  LOADER:=ld-linux-aarch64.so.1
  BACKEND_HASH:=$(TINGREADER_BACKEND_ARM64_HASH)
  LIBC_HASH:=04d7cb73e608b41713b63ef915577f7f5d75e95b1b33174e82e05687fdb6cfaf
  LIBGCC_HASH:=bb1c262f2ac9aeb357d3344a06f22f1057306694f6200896775a03ecced08b13
  LIBC_URL:=http://ports.ubuntu.com/pool/main/g/glibc
  LIBGCC_URL:=http://ports.ubuntu.com/pool/main/g/gcc-14
endif

BACKEND_FILE:=ting-reader-backend-linux-$(APP_ARCH)-$(PKG_VERSION).tar.gz
LIBC_FILE:=libc6_$(GLIBC_VERSION)_$(DEB_ARCH).deb
LIBGCC_FILE:=libgcc-s1_$(LIBGCC_VERSION)_$(DEB_ARCH).deb

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

define Download/tingreader-libc
  FILE:=$(LIBC_FILE)
  URL:=$(LIBC_URL)
  HASH:=$(LIBC_HASH)
endef
$(eval $(call Download,tingreader-libc))

define Download/tingreader-libgcc
  FILE:=$(LIBGCC_FILE)
  URL:=$(LIBGCC_URL)
  HASH:=$(LIBGCC_HASH)
endef
$(eval $(call Download,tingreader-libgcc))

define Package/tingreader
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=Ting Reader audiobook server
  URL:=https://github.com/dqsq2e2/ting-reader
  DEPENDS:=@(x86_64||aarch64||aarch64_generic||aarch64_cortex-a53||aarch64_cortex-a72||aarch64_cortex-a76) +ca-bundle
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
	mkdir -p $(PKG_BUILD_DIR)/debian-root
	tar -xzf $(DL_DIR)/$(BACKEND_FILE)  -C $(PKG_BUILD_DIR)
	tar -xzf $(DL_DIR)/$(FRONTEND_FILE) -C $(PKG_BUILD_DIR)
	cd $(PKG_BUILD_DIR)/debian-root && \
		(ar p $(DL_DIR)/$(LIBC_FILE) data.tar.zst 2>/dev/null | tar --use-compress-program unzstd -xf - 2>/dev/null || \
		 ar p $(DL_DIR)/$(LIBC_FILE) data.tar.xz 2>/dev/null | tar -xJf -)
	cd $(PKG_BUILD_DIR)/debian-root && \
		(ar p $(DL_DIR)/$(LIBGCC_FILE) data.tar.zst 2>/dev/null | tar --use-compress-program unzstd -xf - 2>/dev/null || \
		 ar p $(DL_DIR)/$(LIBGCC_FILE) data.tar.xz 2>/dev/null | tar -xJf -)
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
	if [ -f $(PKG_BUILD_DIR)/debian-root/usr/lib/$(DEB_TRIPLET)/$(LOADER) ]; then \
		$(INSTALL_BIN) $(PKG_BUILD_DIR)/debian-root/usr/lib/$(DEB_TRIPLET)/$(LOADER) \
			$(1)/usr/lib/tingreader/runtime/$(LOADER); \
		$(CP) $(PKG_BUILD_DIR)/debian-root/usr/lib/$(DEB_TRIPLET)/lib*.so.* \
			$(1)/usr/lib/tingreader/runtime/ 2>/dev/null || true; \
	elif [ -f $(PKG_BUILD_DIR)/debian-root/lib/$(DEB_TRIPLET)/$(LOADER) ]; then \
		$(INSTALL_BIN) $(PKG_BUILD_DIR)/debian-root/lib/$(DEB_TRIPLET)/$(LOADER) \
			$(1)/usr/lib/tingreader/runtime/$(LOADER); \
		$(CP) $(PKG_BUILD_DIR)/debian-root/lib/$(DEB_TRIPLET)/lib*.so.* \
			$(1)/usr/lib/tingreader/runtime/ 2>/dev/null || true; \
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
