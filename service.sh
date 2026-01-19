#!/system/bin/sh
# =======================================
# ==========================================

MODDIR="/data/adb/modules/thermal"
PROFILE_FILE="$MODDIR/profile.conf"
FAST_CHARGE_FLAG="$MODDIR/fast_charge_active"

# =========================
# CPU/GPU paths
# =========================
# Big cluster (A78) - CPU4-7
CPU4_GOV="/sys/devices/system/cpu/cpu4/cpufreq/scaling_governor"
CPU5_GOV="/sys/devices/system/cpu/cpu5/cpufreq/scaling_governor"
CPU6_GOV="/sys/devices/system/cpu/cpu6/cpufreq/scaling_governor"
CPU7_GOV="/sys/devices/system/cpu/cpu7/cpufreq/scaling_governor"

CPU4_MAX="/sys/devices/system/cpu/cpu4/cpufreq/scaling_max_freq"
CPU5_MAX="/sys/devices/system/cpu/cpu5/cpufreq/scaling_max_freq"
CPU6_MAX="/sys/devices/system/cpu/cpu6/cpufreq/scaling_max_freq"
CPU7_MAX="/sys/devices/system/cpu/cpu7/cpufreq/scaling_max_freq"

# Little cluster (A55) - CPU0-3
CPU0_GOV="/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"
CPU1_GOV="/sys/devices/system/cpu/cpu1/cpufreq/scaling_governor"
CPU2_GOV="/sys/devices/system/cpu/cpu2/cpufreq/scaling_governor"
CPU3_GOV="/sys/devices/system/cpu/cpu3/cpufreq/scaling_governor"

CPU0_MAX="/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq"
CPU1_MAX="/sys/devices/system/cpu/cpu1/cpufreq/scaling_max_freq"
CPU2_MAX="/sys/devices/system/cpu/cpu2/cpufreq/scaling_max_freq"
CPU3_MAX="/sys/devices/system/cpu/cpu3/cpufreq/scaling_max_freq"

# GPU paths
GPU_GOV="/sys/class/kgsl/kgsl-3d0/devfreq/governor"
GPU_MAX="/sys/class/kgsl/kgsl-3d0/max_freq"

# =========================
# Charging paths
# =========================
BAT_FCC="/sys/class/power_supply/battery/constant_charge_current"
USB_ICL="/sys/class/power_supply/usb/input_current_limit"
UCS_ICL="/sys/class/power_supply/ucs1-source-psy-soc:qcom,pmic_glink:qcom,uCS1/input_current_limit"

# =========================
# Sensor paths
# =========================
BAT_TEMP="/sys/class/power_supply/battery/temp"
BAT_CAPACITY="/sys/class/power_supply/battery/capacity"
BAT_STATUS="/sys/class/power_supply/battery/status"

# =========================
# Functions
# =========================
setv() { [ -e "$2" ] && echo "$1" > "$2" 2>/dev/null; }

get_battery_temp() {
    [ -e "$BAT_TEMP" ] && cat "$BAT_TEMP" 2>/dev/null || echo "300"
}

get_battery_level() {
    [ -e "$BAT_CAPACITY" ] && cat "$BAT_CAPACITY" 2>/dev/null || echo "50"
}

get_charging_status() {
    [ -e "$BAT_STATUS" ] && cat "$BAT_STATUS" 2>/dev/null || echo "Unknown"
}

# =========================
# Profile Control
# =========================
CURRENT_PROFILE=""

apply_profile_once() {
  [ "$CURRENT_PROFILE" = "$1" ] && return

  case "$1" in
    "performance")
      # MAX PERFORMANCE + ENABLE FAST CHARGING
      setv walt "$CPU4_GOV"
      setv walt "$CPU5_GOV"
      setv walt "$CPU6_GOV"
      setv walt "$CPU7_GOV"
      setv 2400000 "$CPU4_MAX"
      setv 2400000 "$CPU5_MAX"
      setv 2400000 "$CPU6_MAX"
      setv 2400000 "$CPU7_MAX"
      
      setv walt "$CPU0_GOV"
      setv walt "$CPU1_GOV"
      setv walt "$CPU2_GOV"
      setv walt "$CPU3_GOV"
      setv 1960000 "$CPU0_MAX"
      setv 1960000 "$CPU1_MAX"
      setv 1960000 "$CPU2_MAX"
      setv 1960000 "$CPU3_MAX"
      
      setv msm-adreno-tz "$GPU_GOV"
      setv 940000000 "$GPU_MAX"
      
      # ENABLE FAST CHARGING FLAG
      echo "1" > "$FAST_CHARGE_FLAG"
      
      echo "PROFILE: Performance + Fast charging ENABLED" > /dev/kmsg 2>/dev/null
      ;;
      
    "balanced")
      # BALANCED - Normal charging
      setv schedutil "$CPU4_GOV"
      setv schedutil "$CPU5_GOV"
      setv schedutil "$CPU6_GOV"
      setv schedutil "$CPU7_GOV"
      setv 2000000 "$CPU4_MAX"
      setv 2000000 "$CPU5_MAX"
      setv 2000000 "$CPU6_MAX"
      setv 2000000 "$CPU7_MAX"
      
      setv schedutil "$CPU0_GOV"
      setv schedutil "$CPU1_GOV"
      setv schedutil "$CPU2_GOV"
      setv schedutil "$CPU3_GOV"
      setv 1500000 "$CPU0_MAX"
      setv 1500000 "$CPU1_MAX"
      setv 1500000 "$CPU2_MAX"
      setv 1500000 "$CPU3_MAX"
      
      setv msm-adreno-tz "$GPU_GOV"
      setv 710000000 "$GPU_MAX"
      
      # DISABLE FAST CHARGING FLAG
      echo "0" > "$FAST_CHARGE_FLAG"
      
      echo "PROFILE: Balanced - Normal charging" > /dev/kmsg 2>/dev/null
      ;;
      
    "battery")
      # BATTERY SAVE - Slow charging
      setv powersave "$CPU4_GOV"
      setv powersave "$CPU5_GOV"
      setv powersave "$CPU6_GOV"
      setv powersave "$CPU7_GOV"
      setv 1200000 "$CPU4_MAX"
      setv 1200000 "$CPU5_MAX"
      setv 1200000 "$CPU6_MAX"
      setv 1200000 "$CPU7_MAX"
      
      setv powersave "$CPU0_GOV"
      setv powersave "$CPU1_GOV"
      setv powersave "$CPU2_GOV"
      setv powersave "$CPU3_GOV"
      setv 1000000 "$CPU0_MAX"
      setv 1000000 "$CPU1_MAX"
      setv 1000000 "$CPU2_MAX"
      setv 1000000 "$CPU3_MAX"
      
      setv msm-adreno-tz "$GPU_GOV"
      setv 430000000 "$GPU_MAX"
      
      # DISABLE FAST CHARGING FLAG
      echo "0" > "$FAST_CHARGE_FLAG"
      
      echo "PROFILE: Battery - Slow charging" > /dev/kmsg 2>/dev/null
      ;;
  esac

  CURRENT_PROFILE="$1"
}

# =========================
# Smart Charging Control
# =========================
apply_smart_charging() {
    local temp_c="$1"
    local battery="$2"
    local charging="$3"
    local profile="$4"
    
    # If not charging, skip
    if [ "$charging" != "Charging" ]; then
        return
    fi
    
    # Check if fast charging is enabled (from performance profile)
    local fast_charge_enabled="0"
    if [ -f "$FAST_CHARGE_FLAG" ]; then
        fast_charge_enabled=$(cat "$FAST_CHARGE_FLAG" 2>/dev/null | tr -d '\n\r')
    fi
    
    # PERFORMANCE PROFILE = FAST CHARGING (with thermal limits)
    if [ "$fast_charge_enabled" = "1" ] && [ "$profile" = "performance" ]; then
        if [ $temp_c -ge 45 ]; then
            # Too hot for fast charging
            setv 2000000 "$USB_ICL"
            setv 2000000 "$UCS_ICL"
            setv 2000000 "$BAT_FCC"
            echo "CHARGING: Performance mode but HOT - Limited to 2A" > /dev/kmsg 2>/dev/null
            
        elif [ $temp_c -ge 40 ]; then
            # Warm - reduced fast charging
            setv 4000000 "$USB_ICL"
            setv 4000000 "$UCS_ICL"
            setv 4000000 "$BAT_FCC"
            echo "CHARGING: Performance mode - Fast 4A (Warm)" > /dev/kmsg 2>/dev/null
            
        elif [ $temp_c -ge 35 ]; then
            # Moderate fast charging
            setv 5000000 "$USB_ICL"
            setv 5000000 "$UCS_ICL"
            setv 5000000 "$BAT_FCC"
            echo "CHARGING: Performance mode - Fast 5A" > /dev/kmsg 2>/dev/null
            
        else
            # Cool - full fast charging
            setv 6100000 "$USB_ICL"
            setv 6100000 "$UCS_ICL"
            setv 6100000 "$BAT_FCC"
            echo "CHARGING: Performance mode - Turbo 6.1A" > /dev/kmsg 2>/dev/null
        fi
        
    # BALANCED PROFILE = NORMAL CHARGING
    elif [ "$profile" = "balanced" ]; then
        if [ $temp_c -ge 42 ]; then
            setv 1500000 "$USB_ICL"
            setv 1500000 "$UCS_ICL"
            setv 1500000 "$BAT_FCC"
        elif [ $temp_c -ge 38 ]; then
            setv 2000000 "$USB_ICL"
            setv 2000000 "$UCS_ICL"
            setv 2000000 "$BAT_FCC"
        else
            setv 2500000 "$USB_ICL"
            setv 2500000 "$UCS_ICL"
            setv 2500000 "$BAT_FCC"
        fi
        echo "CHARGING: Balanced mode - Normal" > /dev/kmsg 2>/dev/null
        
    # BATTERY PROFILE = SLOW CHARGING
    elif [ "$profile" = "battery" ]; then
        # Always slow charging in battery mode
        setv 1000000 "$USB_ICL"
        setv 1000000 "$UCS_ICL"
        setv 1000000 "$BAT_FCC"
        echo "CHARGING: Battery mode - Slow 1A" > /dev/kmsg 2>/dev/null
        
    # DEFAULT
    else
        setv 2500000 "$USB_ICL"
        setv 2500000 "$UCS_ICL"
        setv 2500000 "$BAT_FCC"
        echo "CHARGING: Default - Normal" > /dev/kmsg 2>/dev/null
    fi
}

sleep 10

# Initialize fast charge flag
echo "0" > "$FAST_CHARGE_FLAG" 2>/dev/null

echo "⚡ Smart Thermal Control Started" > /dev/kmsg 2>/dev/null
echo "🔋 Performance profile = Fast charging" > /dev/kmsg 2>/dev/null

LAST_PROFILE=""

# =========================
# MAIN LOOP
# =========================
while true; do
    # Read current conditions
    TEMP_MC=$(get_battery_temp)
    TEMP_C=$((TEMP_MC / 10))
    
    BATTERY=$(get_battery_level)
    CHARGING=$(get_charging_status)
    
    # Read current profile from file
    if [ -f "$PROFILE_FILE" ]; then
        CURRENT_PROFILE_NAME=$(cat "$PROFILE_FILE" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
        
        # Validate profile
        case "$CURRENT_PROFILE_NAME" in
            "performance"|"balanced"|"battery")
                # Valid profile
                ;;
            *)
                CURRENT_PROFILE_NAME="balanced"
                ;;
        esac
    else
        CURRENT_PROFILE_NAME="balanced"
        echo "balanced" > "$PROFILE_FILE"
    fi
    
    # Apply profile (includes fast charging flag)
    apply_profile_once "$CURRENT_PROFILE_NAME"
    
    # Apply smart charging based on profile
    apply_smart_charging "$TEMP_C" "$BATTERY" "$CHARGING" "$CURRENT_PROFILE_NAME"
    
    # Log when profile changes
    if [ "$CURRENT_PROFILE_NAME" != "$LAST_PROFILE" ]; then
        echo "PROFILE CHANGE: ${LAST_PROFILE} → ${CURRENT_PROFILE_NAME}" > /dev/kmsg 2>/dev/null
        LAST_PROFILE="$CURRENT_PROFILE_NAME"
    fi
    
    # Log status every minute
    if [ $(( $(date +%s) % 60 )) -eq 0 ]; then
        echo "STATUS: ${TEMP_C}°C | ${BATTERY}% | ${CHARGING} | Profile: ${CURRENT_PROFILE_NAME}" > /dev/kmsg 2>/dev/null
    fi
    
    sleep 3
done