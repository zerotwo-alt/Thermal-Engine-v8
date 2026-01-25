#!/system/bin/sh
# ==========================================
# ==========================================

MODPATH="${0%/*}"
MODDIR="$MODPATH"

PROFILE_FILE="$MODDIR/profile.conf"
WEBROOT="$MODDIR/webroot"

####################################
# Init profile
####################################
[ -f "$PROFILE_FILE" ] || echo "balanced" > "$PROFILE_FILE"

sed -i 's/\r$//' "$PROFILE_FILE" 2>/dev/null

chmod 0644 "$PROFILE_FILE" 2>/dev/null
chmod 0755 "$MODDIR/service.sh" 2>/dev/null
chmod 0755 "$MODDIR/post-fs-data.sh" 2>/dev/null

[ -f "$MODDIR/squirrel" ] && chmod 0755 "$MODDIR/squirrel"
[ -f "$MODDIR/system/bin/tenginex3" ] && chmod 0755 "$MODDIR/system/bin/tenginex3"

####################################
# WebUI permissions
####################################
if [ -d "$WEBROOT" ]; then
  # Directories
  find "$WEBROOT" -type d -exec chmod 0755 {} \; 2>/dev/null

  # Web & asset files
  find "$WEBROOT" -type f \( \
    -name "*.html" -o \
    -name "*.css" -o \
    -name "*.js" -o \
    -name "*.json" -o \
    -name "*.webp" -o \
    -name "*.mp4" \
  \) -exec chmod 0644 {} \; 2>/dev/null
fi

####################################
# Wait for filesystem stability
####################################
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
# Charging thermal configs (THERMAL ONLY)
####################################
log "Patching charging thermal configs"

find "$MODPATH" -type f -name "charging_*.txt" 2>/dev/null | while read -r file; do
  [ -w "$file" ] || continue
  
  # Skip if file is empty or doesn't contain thermal data
  [ -s "$file" ] || continue
  
  tmp="$file.tmp"
  > "$tmp"
  changed=0
  
  while IFS= read -r line; do
    # Check if line is a thermal entry (temperature,current,time format)
    if echo "$line" | grep -qE '^[0-9]+,[0-9]+,[0-9]+'; then
      # Extract values
      IFS=, read -r temp curr time <<EOF
$line
EOF
      
      # Add 42 to temperature
      new_temp=$((temp + 42))
      echo "$new_temp,$curr,$time" >> "$tmp"
      changed=1
    else
      # Keep other lines as-is
      echo "$line" >> "$tmp"
    fi
  done < "$file"
  
  if [ "$changed" -eq 1 ]; then
    mv -f "$tmp" "$file"
    log "✔ Patched $file"
  else
    rm -f "$tmp"
  fi
done

log "Thermal + WebUI setup complete (no fastcharge)"
exit 0