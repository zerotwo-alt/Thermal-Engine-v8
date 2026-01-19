#!/system/bin/sh
# ==========================================

MODPATH="${0%/*}"

# Wait a bit to ensure module files are accessible
sleep 2

log() {
  echo "[ThermalControl] $1"
}

####################################
# QEGA_Config.txt
####################################
log "Patching QEGA_Config.txt"

find "$MODPATH" -type f -name "QEGA_Config.txt" 2>/dev/null | while read -r file; do
  [ -w "$file" ] || continue

  cat > "$file" <<'EOF'
SkinTemperatureNode:   battery
SkinNodeThrottleTemp:  55000
#GameID   GameAPK    MaxTemperature  MaxCurrent  AvgCurrent
100001    hok         52000          2000        1800
0         adaptive    55000          2000        1800
EOF

  log "✔ Patched $file"
done

####################################
# devices_config.json
####################################
log "Patching devices_config.json"

find "$MODPATH" -type f -name "devices_config.json" 2>/dev/null | while read -r file; do
  [ -w "$file" ] || continue

  tmp="$file.tmp"
  > "$tmp"

  while IFS= read -r line; do
    case "$line" in
      *'"battery.temperate.range"'*)
        echo '  "battery.temperate.range": "[100,420]",' >> "$tmp"
        ;;
      *'"high.capacity.battery.temperate.range"'*)
        echo '  "high.capacity.battery.temperate.range": "[100,420]",' >> "$tmp"
        ;;
      *'"high.capacity.threshold"'*)
        echo '  "high.capacity.threshold": 50,' >> "$tmp"
        ;;
      *)
        echo "$line" >> "$tmp"
        ;;
    esac
  done < "$file"

  mv -f "$tmp" "$file"
  log "✔ Patched $file"
done

####################################
# Charging thermal configs
####################################
log "Patching charging thermal configs"

find "$MODPATH" -type f -name "charging_*.txt" 2>/dev/null | while read -r file; do
  [ -w "$file" ] || continue

  tmp="$file.tmp"
  > "$tmp"

  while IFS= read -r line; do
    case "$line" in
      *:=*)
        echo "$line" >> "$tmp"
        ;;
      *,*,*)
        temp=$(echo "$line" | awk -F, '{print $1}')
        curr=$(echo "$line" | awk -F, '{print $2}')
        time=$(echo "$line" | awk -F, '{print $3}')

        # Raise thermal threshold slightly (+42)
        echo "$((temp + 42)),$curr,$time" >> "$tmp"
        ;;
      *)
        echo "$line" >> "$tmp"
        ;;
    esac
  done < "$file"

  mv -f "$tmp" "$file"
  log "✔ Patched $file"
done

log "post-fs-data thermal patching complete"
exit 0