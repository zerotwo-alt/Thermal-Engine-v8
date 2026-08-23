#!/system/bin/sh
LOG=/data/local/tmp/thermal.log
exec >> "$LOG" 2>&1

echo "[THERMAL] Service start"

while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 2
done
sleep 5
echo "[THERMAL] Boot completed"

THERMAL_SCONFIG="/sys/class/thermal/thermal_message/sconfig"

PKG_NAME="org.lineageos.settings"
PREFS_XML="/data/data/${PKG_NAME}/shared_prefs/${PKG_NAME}_preferences.xml"
PREF_KEY="thermal_control_v2"

for i in $(seq 1 30); do
    [ -e "$THERMAL_SCONFIG" ] && break
    sleep 1
done
[ ! -e "$THERMAL_SCONFIG" ] && { echo "[THERMAL] sysfs node missing, exiting"; exit 0; }

echo "[THERMAL] Thermal sysfs ready"

VAL_DEFAULT=0
VAL_BENCHMARK=10
VAL_BROWSER=11
VAL_CAMERA=12
VAL_DIALER=8
VAL_GAMING=9
VAL_NAVIGATION=19
VAL_STREAMING=14
VAL_VIDEO=21

CAT_GAME=0
CAT_VIDEO=2
CAT_MAPS=6

GMAPS_PKG="com.google.android.apps.maps"
GMEET_PKG="com.google.android.apps.tachyon"

BENCHMARK_PKG="
com.primatelabs.geekbench6
com.antutu.benchmark.full
com.antutu.ABenchMark
com.futuremark.dmandroid.application
"

GAMES_PKG="
com.mobilelegends.mi
com.supercell.brawlstars
com.netease.newspike
com.activision.callofduty.warzone
com.pubg.newstate
com.gamedevltd.destinywarfare
com.pikpok.dr2.play
com.CarXTech.highWay
com.nekki.shadowfight3
com.nekki.shadowfightarena
com.gameloft.android.ANMP.GloftA8HM
com.nekki.shadowfight
com.ea.game.nfs14_row
com.ea.games.r3_row
com.supercell.squad
com.blitzteam.battleprime
com.proximabeta.mf.uamo
com.ea.gp.apexlegendsmobilefps
com.levelinfinite.hotta.gp
com.supercell.clashofclans
com.vng.mlbbvn
com.levelinfinite.sgameGlobal
com.tencent.tmgp.sgame
com.netease.lztgglobal
com.riotgames.league.wildrift
com.riotgames.league.wildrifttw
com.riotgames.league.wildriftvn
com.epicgames.fortnite
com.epicgames.portal
com.tencent.lolm
com.mobile.legends
com.dts.freefireth
com.dts.freefirethmax
com.activision.callofduty.shooter
com.ea.gp.fifamobile
com.gameloft.android.ANMP.GloftA9HM
com.madfingergames.legends
com.pearlabyss.blackdesertm
com.pearlabyss.blackdesertm.gl
com.blizzard.diablo.immortal
com.pubg.imobile
com.pubg.krmobile
com.rekoo.pubgm
com.tencent.ig
com.tencent.tmgp.pubgmhd
com.vng.pubgmobile
com.miraclegames.farlight84
com.garena.game.codm
com.tencent.tmgp.kr.codm
com.vng.codmvn
com.proxima.dfm
"

GAMES_KEYWORDS="
hok hok_oversea GP Infinity_Nikki NARAKA_BLADEPOINT JusticeOnline
Seasun_JXOnline3 Tencent_DFM Tencent_PRacing WutheringWaves
PerfectWorld_P5X Netease_Diablo Racing_Master Tarisland
Arena_Breakout Tencent_DNF Tencent_LOL Tencent_Spatula
StarRail ZenlessZoneZero CarX_Street
"

CACHE_PKG=""
CACHE_DUMP=""

get_pkg_dump() {
    pkg="$1"
    if [ "$pkg" != "$CACHE_PKG" ]; then
        CACHE_PKG="$pkg"
        CACHE_DUMP=$(dumpsys package "$pkg" 2>/dev/null)
    fi
    echo "$CACHE_DUMP"
}

is_system_overlay() {
    case "$1" in
        com.android.systemui)                  return 0 ;;
        com.miui.home)                         return 0 ;;
        com.sec.android.app.launcher)          return 0 ;;
        com.google.android.apps.nexuslauncher) return 0 ;;
        com.android.launcher*)                 return 0 ;;
        com.oneplus.launcher)                  return 0 ;;
        com.oppo.launcher)                     return 0 ;;
        com.coloros.launcher)                  return 0 ;;
        com.vivo.launcher)                     return 0 ;;
        com.asus.launcher)                     return 0 ;;
    esac
    return 1
}

is_screen_on() {
    dumpsys power 2>/dev/null \
        | grep -qE 'mScreenOn=true|Display Power: state=ON'
}

get_foreground_pkg() {
    pkg=$(dumpsys activity activities 2>/dev/null \
        | grep -m1 'topResumedActivity' \
        | sed -n 's/.* \([A-Za-z0-9_.]*\)\/[^ ]* .*/\1/p')

    if [ -z "$pkg" ]; then
        pkg=$(cmd activity stack list 2>/dev/null \
            | grep -m1 'visible=true.*topActivity' \
            | sed -n 's/.*topActivity=\([^\/} ]*\)\/.*/\1/p')
    fi

    if [ -z "$pkg" ]; then
        pkg=$(dumpsys window 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" \
            | sed -n 's/.* \([^\/]*\)\/.*/\1/p' | head -n 1)
    fi
    echo "$pkg"
}

get_user_override() {
    pkg="$1"
    [ -e "$PREFS_XML" ] || return 1

    raw=$(grep -o "name=\"$PREF_KEY\">[^<]*" "$PREFS_XML" 2>/dev/null \
        | sed 's/.*">//')
    [ -z "$raw" ] && return 1

    raw=$(echo "$raw" | sed 's/&amp;/\&/g')

    OLDIFS="$IFS"
    IFS=':'
    profile=""
    for segment in $raw; do
        case "$segment" in
            thermal.benchmark=*"${pkg},"*)  profile="benchmark"  ;;
            thermal.browser=*"${pkg},"*)    profile="browser"    ;;
            thermal.camera=*"${pkg},"*)     profile="camera"     ;;
            thermal.dialer=*"${pkg},"*)     profile="dialer"     ;;
            thermal.gaming=*"${pkg},"*)     profile="gaming"     ;;
            thermal.navigation=*"${pkg},"*) profile="navigation" ;;
            thermal.streaming=*"${pkg},"*)  profile="streaming"  ;;
            thermal.video=*"${pkg},"*)      profile="video"      ;;
            thermal.default=*"${pkg},"*)    profile="default"    ;;
        esac
        [ -n "$profile" ] && break
    done
    IFS="$OLDIFS"

    [ -z "$profile" ] && return 1
    echo "$profile"
    return 0
}

is_browser_app() {
    pm query-activities \
        -a android.intent.action.VIEW \
        -d "http://example.com" 2>/dev/null \
        | grep -q "packageName=$1"
}

is_dialer_app() {
    default_dialer=$(cmd telephony get-default-dialer 2>/dev/null)
    [ -z "$default_dialer" ] && \
        default_dialer=$(settings get secure dialer_default_application 2>/dev/null)
    [ "$1" = "$default_dialer" ]
}

is_camera_app() {
    pm query-activities \
        -a android.media.action.STILL_IMAGE_CAMERA 2>/dev/null \
        | grep -q "packageName=$1"
}

classify_package() {
    pkg="$1"

    override=$(get_user_override "$pkg")
    if [ -n "$override" ]; then
        echo "$override"
        return
    fi

    case "$pkg" in
        "$GMAPS_PKG") echo "navigation"; return ;;
        "$GMEET_PKG") echo "streaming";  return ;;
    esac

    dump=$(get_pkg_dump "$pkg")
    cat=$(echo "$dump" | grep -m1 'category=' | grep -o 'category=[0-9-]*' | cut -d= -f2)
    case "$cat" in
        "$CAT_GAME")  echo "gaming";     return ;;
        "$CAT_VIDEO") echo "video";      return ;;
        "$CAT_MAPS")  echo "navigation"; return ;;
    esac

    for b in $BENCHMARK_PKG; do
        [ "$pkg" = "$b" ] && echo "benchmark" && return
    done

    for g in $GAMES_PKG; do
        [ "$pkg" = "$g" ] && echo "gaming" && return
    done
    for g in $GAMES_KEYWORDS; do
        echo "$pkg" | grep -qi "$g" && echo "gaming" && return
    done

    if is_browser_app "$pkg"; then
        echo "browser"; return
    fi

    if is_dialer_app "$pkg"; then
        echo "dialer"; return
    fi

    if is_camera_app "$pkg"; then
        echo "camera"; return
    fi

    echo "default"
}

apply_profile() {
    echo "$1" > "$THERMAL_SCONFIG"
    CURRENT_VALUE="$1"
    echo "[THERMAL] Set $2 = $1"
}

apply_default()    { apply_profile "$VAL_DEFAULT"    "default"; }
apply_benchmark()  { apply_profile "$VAL_BENCHMARK"  "benchmark"; }
apply_browser()    { apply_profile "$VAL_BROWSER"    "browser"; }
apply_camera()     { apply_profile "$VAL_CAMERA"     "camera"; }
apply_dialer()     { apply_profile "$VAL_DIALER"     "dialer"; }
apply_gaming()     { apply_profile "$VAL_GAMING"     "gaming"; }
apply_navigation() { apply_profile "$VAL_NAVIGATION" "navigation"; }
apply_streaming()  { apply_profile "$VAL_STREAMING"  "streaming"; }
apply_video()      { apply_profile "$VAL_VIDEO"      "video"; }

apply_for_profile() {
    case "$1" in
        gaming)     apply_gaming     ;;
        benchmark)  apply_benchmark  ;;
        browser)    apply_browser    ;;
        camera)     apply_camera     ;;
        dialer)     apply_dialer     ;;
        navigation) apply_navigation ;;
        streaming)  apply_streaming  ;;
        video)      apply_video      ;;
        *)          apply_default    ;;
    esac
}

ACTIVE_PKG=""
ACTIVE_PROF="default"
CURRENT_VALUE=0
SCREEN_ON=1

apply_default
echo "[THERMAL] Initial default applied"

while true; do

    if ! is_screen_on; then
        if [ "$SCREEN_ON" = "1" ]; then
            SCREEN_ON=0
            echo "[THERMAL] Screen OFF -> default"
            apply_default
        fi
        sleep 2
        continue
    fi

    if [ "$SCREEN_ON" = "0" ]; then
        SCREEN_ON=1
        echo "[THERMAL] Screen ON -> restoring: $ACTIVE_PKG ($ACTIVE_PROF)"
        apply_for_profile "$ACTIVE_PROF"
    fi

    FG_PKG=$(get_foreground_pkg)

    [ -z "$FG_PKG" ] && sleep 1 && continue

    is_system_overlay "$FG_PKG" && sleep 1 && continue

    [ "$FG_PKG" = "$ACTIVE_PKG" ] && sleep 1 && continue

    CACHE_PKG=""
    PROFILE=$(classify_package "$FG_PKG")
    echo "[THERMAL] Foreground: $FG_PKG -> $PROFILE (was: $ACTIVE_PKG -> $ACTIVE_PROF)"

    apply_for_profile "$PROFILE"

    ACTIVE_PKG="$FG_PKG"
    ACTIVE_PROF="$PROFILE"

    sleep 1
done
