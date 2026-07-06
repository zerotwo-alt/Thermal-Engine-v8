#!/system/bin/sh
THERMAL_SCONFIG="/sys/class/thermal/thermal_message/sconfig"
THERMAL_BOOST="/sys/class/thermal/thermal_message/boost"

[ -e "$THERMAL_SCONFIG" ] && echo 0 > "$THERMAL_SCONFIG"
[ -e "$THERMAL_BOOST" ] && echo 0 > "$THERMAL_BOOST"

exit 0
