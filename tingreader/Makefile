TINGREADER_PACKAGE_DIR:=$(dir $(abspath $(lastword $(MAKEFILE_LIST))))

include $(TOPDIR)/rules.mk

include $(TINGREADER_PACKAGE_DIR)../version.mk

PKG_NAME:=tingreader
PKG_VERSION:=$(TINGREADER_VERSION)
PKG_RELEASE:=1

PKG_LICENSE:=AGPL-3.0-only AND LGPL-2.1-or-later AND OpenSSL
PKG_MAINTAINER:=Ting Reader contributors
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)-$(ARCH)

TINGREADER_RELEASE_URL:=https://github.com/dqsq2e2/ting-reader/releases/download/v$(PKG_VERSION)
FRONTEND_FILE:=ting-reader-frontend-$(PKG_VERSION).tar.gz

DEBIAN_VERSION:=12
GLIBC_VERSION:=2.36-9+deb12u14
LIBGCC_VERSION:=12.2.0-14+deb12u1
OPENSSL_VERSION:=3.0.20-1~deb12u2

ifeq ($(ARCH),x86_64)
  APP_ARCH:=amd64
  DEB_ARCH:=amd64
  DEB_TRIPLET:=x86_64-linux-gnu
  LOADER:=ld-linux-x86-64.so.2
  BACKEND_HASH:=$(TINGREADER_BACKEND_AMD64_HASH)
  LIBC_HASH:=ba4f88f73dbc3ae9055f3c20f4523bfdbaf1ad13ff95e258924f77d20b4fbedf
  GCCBASE_HASH:=1896a2aacf4ad681ff5eacc24a5b0ca4d5d9c9b9c9e4b6de5197bc1e116ea619
  LIBGCC_HASH:=3016e62cb4b7cd8038822870601f5ed131befe942774d0f745622cc77d8a88f7
  LIBSSL_HASH:=89be24b41bff568ee6e7caf5680a3d808e80315ed92e407056ce0fa7a5bda025
endif

ifeq ($(ARCH),aarch64)
  APP_ARCH:=arm64
  DEB_ARCH:=arm64
  DEB_TRIPLET:=aarch64-linux-gnu
  LOADER:=ld-linux-aarch64.so.1
  BACKEND_HASH:=$(TINGREADER_BACKEND_ARM64_HASH)
  LIBC_HASH:=01f4330719fd4f65580e16ea5a0527f372fca750e8f588d26deaf09f2d3b1cf4
  GCCBASE_HASH:=674cf6cba6d432bd200c45fe866c1652c7a53523cc2e7a613e05bc4abf7b5440
  LIBGCC_HASH:=576926b283613db80168ddf76380a3bd877602778cf0d226caa7bfbfa71eacf3
  LIBSSL_HASH:=a256e03cc3abd7243ac5c6ee91a9deb56478221ef0d3c2b0748551e13140c0bf
endif

BACKEND_FILE:=ting-reader-backend-linux-$(APP_ARCH)-$(PKG_VERSION).tar.gz
LIBC_FILE:=libc6_$(GLIBC_VERSION)_$(DEB_ARCH).deb
GCCBASE_FILE:=gcc-12-base_$(LIBGCC_VERSION)_$(DEB_ARCH).deb
LIBGCC_FILE:=libgcc-s1_$(LIBGCC_VERSION)_$(DEB_ARCH).deb
LIBSSL_FILE:=libssl3_$(OPENSSL_VERSION)_$(DEB_ARCH).deb

PKG_SOURCE:=$(BACKEND_FILE)
PKG_SOURCE_URL:=$(TINGREADER_RELEASE_URL)
PKG_HASH:=$(BACKEND_HASH)

include $(INCLUDE_DIR)/package.mk

RSTRIP:=:

define Download/tingreader-frontend
  FILE:=$(FRONTEND_FILE)
  URL:=$(TINGREADER_RELEASE_URL)
  HASH:=$(TINGREADER_FRONTEND_HASH)
endef
$(eval $(call Download,tingreader-frontend))

define Download/tingreader-libc
  FILE:=$(LIBC_FILE)
  URL:=https://deb.debian.org/debian/pool/main/g/glibc
  HASH:=$(LIBC_HASH)
endef
$(eval $(call Download,tingreader-libc))

define Download/tingreader-libgcc
  FILE:=$(LIBGCC_FILE)
  URL:=https://deb.debian.org/debian/pool/main/g/gcc-12
  HASH:=$(LIBGCC_HASH)
endef
$(eval $(call Download,tingreader-libgcc))

define Download/tingreader-gccbase
  FILE:=$(GCCBASE_FILE)
  URL:=https://deb.debian.org/debian/pool/main/g/gcc-12
  HASH:=$(GCCBASE_HASH)
endef
$(eval $(call Download,tingreader-gccbase))

define Download/tingreader-libssl
  FILE:=$(LIBSSL_FILE)
  URL:=https://deb.debian.org/debian/pool/main/o/openssl
  HASH:=$(LIBSSL_HASH)
endef
$(eval $(call Download,tingreader-libssl))

define Package/tingreader
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=Ting Reader audiobook server
  URL:=https://github.com/dqsq2e2/ting-reader
  DEPENDS:=@(x86_64||aarch64) +ca-bundle
endef

define Package/tingreader/description
  Ting Reader is a self-hosted audiobook server. This package combines the
  official Linux backend and frontend release archives and carries a private
  GNU runtime because the upstream backend is dynamically linked against glibc.
endef

define Package/tingreader/conffiles
/etc/config/tingreader
endef

define Build/Prepare
	rm -rf $(PKG_BUILD_DIR)
	mkdir -p $(PKG_BUILD_DIR)/debian-root
	tar -xzf $(DL_DIR)/$(BACKEND_FILE) -C $(PKG_BUILD_DIR)
	tar -xzf $(DL_DIR)/$(FRONTEND_FILE) -C $(PKG_BUILD_DIR)
	cd $(PKG_BUILD_DIR)/debian-root && \
		ar p $(DL_DIR)/$(LIBC_FILE) data.tar.xz | tar -xJf -
	cd $(PKG_BUILD_DIR)/debian-root && \
		ar p $(DL_DIR)/$(GCCBASE_FILE) data.tar.xz | tar -xJf -
	cd $(PKG_BUILD_DIR)/debian-root && \
		ar p $(DL_DIR)/$(LIBGCC_FILE) data.tar.xz | tar -xJf -
	cd $(PKG_BUILD_DIR)/debian-root && \
		ar p $(DL_DIR)/$(LIBSSL_FILE) data.tar.xz | tar -xJf -
endef

define Build/Compile
endef

define Package/tingreader/install
	$(INSTALL_DIR) $(1)/usr/lib/tingreader/runtime
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/ting-reader $(1)/usr/lib/tingreader/ting-reader
	$(CP) $(PKG_BUILD_DIR)/static $(1)/usr/lib/tingreader/
	$(CP) $(PKG_BUILD_DIR)/preinstalled-plugins $(1)/usr/lib/tingreader/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/debian-root/lib/$(DEB_TRIPLET)/$(LOADER) \
		$(1)/usr/lib/tingreader/runtime/$(LOADER)
	$(CP) $(PKG_BUILD_DIR)/debian-root/lib/$(DEB_TRIPLET)/lib*.so.* \
		$(1)/usr/lib/tingreader/runtime/
	$(CP) $(PKG_BUILD_DIR)/debian-root/usr/lib/$(DEB_TRIPLET)/libcrypto.so.3 \
		$(PKG_BUILD_DIR)/debian-root/usr/lib/$(DEB_TRIPLET)/libssl.so.3 \
		$(1)/usr/lib/tingreader/runtime/

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

	$(INSTALL_DIR) $(1)/usr/share/licenses/tingreader/runtime
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/debian-root/usr/share/doc/libc6/copyright \
		$(1)/usr/share/licenses/tingreader/runtime/libc6-copyright
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/debian-root/usr/share/doc/libgcc-s1/copyright \
		$(1)/usr/share/licenses/tingreader/runtime/libgcc-s1-copyright
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/debian-root/usr/share/doc/libssl3/copyright \
		$(1)/usr/share/licenses/tingreader/runtime/libssl3-copyright
endef

define Package/tingreader/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /etc/init.d/tingreader enable
exit 0
endef

$(eval $(call BuildPackage,tingreader))
