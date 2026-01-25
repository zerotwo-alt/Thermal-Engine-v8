#!/system/bin/sh
# ==========================================

MODDIR="${0%/*}"
BACKUP="/data/adb/modules/thermal/.backup"
LOG="/data/local/tmp/thermal_uninstall.log"

ui_print() {
  echo "$1"
  echo "$1" >> "$LOG"
}

ui_print "======================================"
ui_print " Thermal Engine V8 - Full Restore"
ui_print "======================================"

# ---------------------------------------
# Stop services
# ---------------------------------------
ui_print "- Stopping services..."
pkill -f thermal 2>/dev/null
pkill -f monitor 2>/dev/null
pkill -f service.sh 2>/dev/null
pkill -f post-fs-data.sh 2>/dev/null
sleep 1

# ---------------------------------------
# Restore thermal_message
# ---------------------------------------
ui_print "- Restoring thermal parameters..."

restore_thermal() {
  local name="$1"
  local path="/sys/class/thermal/thermal_message/$name"

  if [ -f "$BACKUP/$name" ] && [ -e "$path" ]; then
    cat "$BACKUP/$name" > "$path" 2>/dev/null
  elif [ -e "$path" ]; then
    # Safe fallback
    echo 0 > "$path" 2>/dev/null
  fi
}

restore_thermal sconfig
restore_thermal boost
restore_thermal balance_mode

# ---------------------------------------
# Restore CPU governors & frequencies
# ---------------------------------------
ui_print "- Restoring CPU settings..."

for cpu in /sys/devices/system/cpu/cpu[0-9]*; do
  id="$(basename "$cpu")"

  gov="$cpu/cpufreq/scaling_governor"
  max="$cpu/cpufreq/scaling_max_freq"

  if [ -e "$gov" ]; then
    if [ -f "$BACKUP/${id}_gov" ]; then
      cat "$BACKUP/${id}_gov" > "$gov" 2>/dev/null
    else
      echo schedutil > "$gov" 2>/dev/null
    fi
  fi

  if [ -e "$max" ]; then
    if [ -f "$BACKUP/${id}_max" ]; then
      cat "$BACKUP/${id}_max" > "$max" 2>/dev/null
    fi
  fi
done

# ---------------------------------------
# Restore GPU settings
# ---------------------------------------
ui_print "- Restoring GPU settings..."

GPU_GOV="/sys/class/kgsl/kgsl-3d0/devfreq/governor"
GPU_MAX="/sys/class/kgsl/kgsl-3d0/max_freq"

if [ -e "$GPU_GOV" ]; then
  if [ -f "$BACKUP/gpu_gov" ]; then
    cat "$BACKUP/gpu_gov" > "$GPU_GOV" 2>/dev/null
  else
    echo msm-adreno-tz > "$GPU_GOV" 2>/dev/null
  fi
fi

if [ -e "$GPU_MAX" ] && [ -f "$BACKUP/gpu_max" ]; then
  cat "$BACKUP/gpu_max" > "$GPU_MAX" 2>/dev/null
fi

# ---------------------------------------
# Remove persisted files
# ---------------------------------------
ui_print "- Removing module state..."

rm -f /data/adb/modules/thermal/profile.conf 2>/dev/null
rm -f /data/adb/modules/thermal/.js_sync 2>/dev/null
rm -rf "$BACKUP" 2>/dev/null

# ---------------------------------------
# Reset properties
# ---------------------------------------
ui_print "- Resetting thermal props..."

resetprop --delete persist.vendor.thermal.profile 2>/dev/null
resetprop --delete persist.vendor.thermal.engine 2>/dev/null
resetprop --delete persist.sys.thermal.mode 2>/dev/null

sync

ui_print "--------------------------------------"
ui_print " All CPU, GPU, Thermal settings restored"
ui_print " Reboot is STRONGLY recommended"
ui_print "--------------------------------------"

exit 0