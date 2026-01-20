#!/system/bin/sh
# =======================================
# Charging-only Service
# ==========================================

MODDIR="/data/adb/modules/thermal"
PROFILE_FILE="$MODDIR/profile.conf"
FAST_CHARGE_FLAG="$MODDIR/fast_charge_active"

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

sleep 10

echo "0" > "$FAST_CHARGE_FLAG" 2>/dev/null

# Ensure profile file exists
if [ ! -f "$PROFILE_FILE" ]; then
    echo "balanced" > "$PROFILE_FILE"
fi

echo "⚡ Smart Charging Control Started" > /dev/kmsg 2>/dev/null

while true; do
    # Read profile
    if [ -f "$PROFILE_FILE" ]; then
        PROFILE=$(cat "$PROFILE_FILE" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
    else
        PROFILE="balanced"
    fi
    
    # Get battery info
    TEMP_MC=$(get_battery_temp)
    TEMP_C=$((TEMP_MC / 10))
    CHARGING=$(get_charging_status)
    
    # Update fast charge flag based on profile
    if [ "$PROFILE" = "performance" ]; then
        echo "1" > "$FAST_CHARGE_FLAG"
    else
        echo "0" > "$FAST_CHARGE_FLAG"
    fi
    
    # Apply smart charging (only charging logic, no CPU/GPU)
    if [ "$CHARGING" = "Charging" ]; then
        if [ "$PROFILE" = "performance" ]; then
            # Fast charging logic
            if [ $temp_c -ge 45 ]; then
                setv 2000000 "$USB_ICL"
                setv 2000000 "$UCS_ICL"
                setv 2000000 "$BAT_FCC"
            elif [ $temp_c -ge 40 ]; then
                setv 4000000 "$USB_ICL"
                setv 4000000 "$UCS_ICL"
                setv 4000000 "$BAT_FCC"
            elif [ $temp_c -ge 35 ]; then
                setv 5000000 "$USB_ICL"
                setv 5000000 "$UCS_ICL"
                setv 5000000 "$BAT_FCC"
            else
                setv 6100000 "$USB_ICL"
                setv 6100000 "$UCS_ICL"
                setv 6100000 "$BAT_FCC"
            fi
        elif [ "$PROFILE" = "balanced" ]; then
            # Normal charging
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
        elif [ "$PROFILE" = "battery" ]; then
            # Slow charging
            setv 1000000 "$USB_ICL"
            setv 1000000 "$UCS_ICL"
            setv 1000000 "$BAT_FCC"
        fi
    fi
    
    sleep 5
done