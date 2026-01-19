#!/system/bin/sh

SKIPMOUNT=false
PROPFILE=true
POSTFSDATA=true
LATESTARTSERVICE=true

REPLACE="
"

print_modname() {
  ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ui_print "  Thermal Control – T-ENGINE"
  ui_print "  Version : 8.0 – Arise"
  ui_print "  Author  : ZeroTwo × Agnann"
  ui_print "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ui_print ""
}

on_install() {

  print_modname

  ui_print "> Extracting module files..."

  unzip -o "$ZIPFILE" 'system/*' -d "$MODPATH" >&2
  unzip -o "$ZIPFILE" 'webroot/*' -d "$MODPATH" >&2
  unzip -o "$ZIPFILE" 'service.sh' -d "$MODPATH" >&2
  unzip -o "$ZIPFILE" 'post-fs-data.sh' -d "$MODPATH" >&2
  unzip -o "$ZIPFILE" 'profile.conf' -d "$MODPATH" >&2
  unzip -o "$ZIPFILE" 'squirrel' -d "$MODPATH" >&2

  ui_print "✔ Installation complete"
}

set_permissions() {

  # Module root
  set_perm "$MODPATH" 0 0 0755

  # Installer
  set_perm "$MODPATH/customize.sh" 0 0 0755

  # Service scripts
  set_perm "$MODPATH/service.sh" 0 0 0755
  set_perm "$MODPATH/post-fs-data.sh" 0 0 0755

  # KernelSU WebUI binary
  set_perm "$MODPATH/squirrel" 0 0 0755

  # Config
  set_perm "$MODPATH/profile.conf" 0 0 0644
  set_perm "$MODPATH/module.prop" 0 0 0644

  # System overlay
  [ -d "$MODPATH/system" ] && \
    set_perm_recursive "$MODPATH/system" 0 0 0755 0644

  # WebUI
  [ -d "$MODPATH/webroot" ] && \
    set_perm_recursive "$MODPATH/webroot" 0 0 0755 0644
}