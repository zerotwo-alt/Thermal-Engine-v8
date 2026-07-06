#!/system/bin/sh
#
# Thermal profile auto-switcher.
# Mirrors org.lineageos.settings.thermal (ThermalService / ThermalUtils) with
# user overrides honored exactly like the Settings UI (ThermalSettingsFragment)
# expects, plus a couple of optional auto-detection extras layered on top.
#
LOG=/data/local/tmp/thermal.log
exec >> "$LOG" 2>&1

echo "[THERMAL] Service start"

# -------------------------
# WAIT FOR BOOT
# -------------------------
while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 2
done
sleep 5
echo "[THERMAL] Boot completed"

# -------------------------
# PATHS
# -------------------------
MODDIR=${0%/*}
THERMAL_SCONFIG="/sys/class/thermal/thermal_message/sconfig"

# Config XML created by this module's customize.sh on install.
# Edit /data/system/thermal_control.xml directly (or via your own tool) to
# add/move packages between profiles — same format ThermalUtils would write.
PREFS_XML="/data/system/thermal_control.xml"
PREF_KEY="thermal_control"

for i in $(seq 1 30); do
    [ -e "$THERMAL_SCONFIG" ] && break
    sleep 1
done
[ ! -e "$THERMAL_SCONFIG" ] && exit 0

echo "[THERMAL] Thermal sysfs ready"

# -------------------------
# PROFILE VALUES
# Mirrors ThermalUtils.THERMAL_STATE_MAP
# -------------------------
VAL_DEFAULT=0
VAL_BENCHMARK=10
VAL_BROWSER=11
VAL_CAMERA=12
VAL_DIALER=8
VAL_GAMING=9
VAL_NAVIGATION=19
VAL_STREAMING=14
VAL_VIDEO=21

# ApplicationInfo category IDs
CAT_GAME=1
CAT_VIDEO=3
CAT_MAPS=7

# -------------------------
# KNOWN SPECIAL PACKAGES
# Mirrors ThermalUtils.getDefaultStateForPackage switch
# -------------------------
GMAPS_PKG="com.google.android.apps.maps"
GMEET_PKG="com.google.android.apps.tachyon"

# -------------------------
# OPTIONAL EXTRAS (not in upstream ThermalUtils — upstream's own comment
# says STATE_BENCHMARK/STATE_STREAMING auto-detection was never finished).
# These only run if nothing else -- including a user override -- matched.
# -------------------------
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

# -------------------------
# PACKAGE DUMP CACHE
# dumpsys package is called once per app switch, result reused
# -------------------------
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

# -------------------------
# SYSTEM OVERLAY PACKAGES
# QS panel, notification shade, recents — never trigger profile change
# -------------------------
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

# -------------------------
# SCREEN STATE
# -------------------------
is_screen_on() {
    dumpsys power 2>/dev/null \
        | grep -qE 'mScreenOn=true|Display Power: state=ON'
}

# -------------------------
# FOREGROUND APP
# Prefer the real focused-task query (mirrors ActivityTaskManager
# .getFocusedRootTaskInfo() that ThermalService's TaskStackListener uses);
# dumpsys window's mCurrentFocus/mFocusedApp text format drifts across
# OEM skins and is kept only as a fallback.
# -------------------------
get_foreground_pkg() {
    pkg=$(cmd activity stack list 2>/dev/null \
        | grep -m1 'visible=true.*topActivity' \
        | sed -n 's/.*topActivity=\([^\/} ]*\)\/.*/\1/p')

    if [ -z "$pkg" ]; then
        pkg=$(dumpsys window 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" \
            | sed -n 's/.* \([^\/]*\)\/.*/\1/p' | head -n 1)
    fi
    echo "$pkg"
}

# -------------------------
# USER OVERRIDE LOOKUP
# Mirrors ThermalUtils.getStateForPackage()'s priority logic, reading the
# config file customize.sh creates at install time (this module ships no
# Settings app, so there's no SharedPreferences/spinner UI — edit the XML
# directly to move a package between profiles).
#
# IMPORTANT: match by LABEL ("thermal.gaming="), not by field position.
# customize.sh's default XML only ships 6 of the 9 possible segments
# (benchmark/browser/camera/dialer/gaming/streaming — navigation, video,
# and default are omitted), and even the segments it does ship are not
# in ThermalUtils.STATE_* order ("streaming" sits right after "gaming",
# not at the end). A positional 0..8 index would silently misclassify or
# miss matches against this file. Splitting on the label text instead is
# correct regardless of which fields are present or what order they're in.
# A user setting ANY profile (including "default") for a package is an
# explicit override and short-circuits auto-detection, exactly as in
# getStateForPackage's if/else chain.
# -------------------------
get_user_override() {
    pkg="$1"
    [ -e "$PREFS_XML" ] || return 1

    raw=$(grep -o "<string name=\"$PREF_KEY\">[^<]*" "$PREFS_XML" 2>/dev/null \
        | sed "s/.*\">//")
    [ -z "$raw" ] && return 1

    # XML escapes & as &amp; — the value itself never contains a literal &
    # so a plain unescape is sufficient here.
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

# -------------------------
# BROWSER DETECTION
# Mirrors AppUtils.isBrowserApp:
# App handles VIEW intent with http/https scheme
# -------------------------
is_browser_app() {
    pm query-activities \
        -a android.intent.action.VIEW \
        -d "http://example.com" 2>/dev/null \
        | grep -q "packageName=$1"
}

# -------------------------
# DIALER DETECTION
# Mirrors DefaultDialerManager.getDefaultDialerApplication:
# Package is the system default phone/dialer app
# -------------------------
is_dialer_app() {
    default_dialer=$(cmd telephony get-default-dialer 2>/dev/null)
    [ -z "$default_dialer" ] && \
        default_dialer=$(settings get secure dialer_default_application 2>/dev/null)
    [ "$1" = "$default_dialer" ]
}

# -------------------------
# CAMERA DETECTION
# Mirrors ThermalUtils.isCameraApp:
# App handles STILL_IMAGE_CAMERA intent (not just the default, any handler)
# -------------------------
is_camera_app() {
    pm query-activities \
        -a android.media.action.STILL_IMAGE_CAMERA 2>/dev/null \
        | grep -q "packageName=$1"
}

# -------------------------
# CLASSIFY PACKAGE
# Order mirrors ThermalUtils exactly for steps 2-6 (getStateForPackage
# falling through to getDefaultStateForPackage). Step 1 (user override) is
# the real priority override the original script was missing entirely.
# Steps marked EXTRA are optional additions layered on top, not present
# upstream.
#
#   1. User override (Settings UI)   -> getStateForPackage's modes[] lookup
#   2. Special packages              -> GMaps -> navigation, GMeet -> streaming
#   3. ApplicationInfo.category      -> game / video / maps
#  [x. Benchmark list]               -> EXTRA, not in upstream
#  [x. isGame flag / Play Games SDK] -> EXTRA, not in upstream
#  [x. Manual game list/keywords]    -> EXTRA, not in upstream
#   4. Browser intent check          -> AppUtils.isBrowserApp
#   5. Default dialer check          -> DefaultDialerManager
#   6. Camera intent check           -> isCameraApp
#   7. Default
# -------------------------
classify_package() {
    pkg="$1"

    # 1. User override — always wins, matches getStateForPackage()
    override=$(get_user_override "$pkg")
    if [ -n "$override" ]; then
        echo "$override"
        return
    fi

    # 2. Special known packages
    case "$pkg" in
        "$GMAPS_PKG") echo "navigation"; return ;;
        "$GMEET_PKG") echo "streaming";  return ;;
    esac

    # 3. ApplicationInfo.category (mirrors LineageOS category switch)
    dump=$(get_pkg_dump "$pkg")
    cat=$(echo "$dump" | grep -m1 'category=' | grep -o 'category=[0-9]*' | cut -d= -f2)
    case "$cat" in
        "$CAT_GAME")  echo "gaming";     return ;;
        "$CAT_VIDEO") echo "video";      return ;;
        "$CAT_MAPS")  echo "navigation"; return ;;
    esac

    # --- EXTRAS below this line are not part of upstream ThermalUtils ---

    # Benchmark list (checked before game signals — benchmarks often
    # carry game-like signals and would otherwise misclassify as gaming)
    for b in $BENCHMARK_PKG; do
        [ "$pkg" = "$b" ] && echo "benchmark" && return
    done

    # isGame flag / Play Games SDK
    if echo "$dump" | grep -q 'isGame=true' || \
       echo "$dump" | grep -q 'com.google.android.gms.games'; then
        echo "gaming"; return
    fi

    # Manual game list + keywords (fallback for detection-evading games)
    for g in $GAMES_PKG; do
        [ "$pkg" = "$g" ] && echo "gaming" && return
    done
    for g in $GAMES_KEYWORDS; do
        echo "$pkg" | grep -qi "$g" && echo "gaming" && return
    done

    # --- back to upstream order ---

    # 4. Browser — mirrors AppUtils.isBrowserApp
    if is_browser_app "$pkg"; then
        echo "browser"; return
    fi

    # 5. Default dialer — mirrors DefaultDialerManager.getDefaultDialerApplication
    if is_dialer_app "$pkg"; then
        echo "dialer"; return
    fi

    # 6. Camera — mirrors ThermalUtils.isCameraApp (STILL_IMAGE_CAMERA intent)
    if is_camera_app "$pkg"; then
        echo "camera"; return
    fi

    # 7. Default
    echo "default"
}

# -------------------------
# APPLY HELPERS
# -------------------------
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
apply_navigation() { apply_profile "$VAL_NAVIGATION" "navigation"; }
apply_streaming()  { apply_profile "$VAL_STREAMING"  "streaming"; }
apply_video()      { apply_profile "$VAL_VIDEO"      "video"; }

apply_gaming_enter() {
    for i in 1 2 3 4 5; do
        echo "$VAL_GAMING" > "$THERMAL_SCONFIG"
        usleep 200000
    done
    CURRENT_VALUE="$VAL_GAMING"
    echo "[THERMAL] Set gaming enter = $VAL_GAMING"
}

apply_for_profile() {
    case "$1" in
        gaming)     apply_gaming_enter ;;
        benchmark)  apply_benchmark    ;;
        browser)    apply_browser      ;;
        camera)     apply_camera       ;;
        dialer)     apply_dialer       ;;
        navigation) apply_navigation   ;;
        streaming)  apply_streaming    ;;
        video)      apply_video        ;;
        *)          apply_default      ;;
    esac
}

# -------------------------
# STATE
# -------------------------
ACTIVE_PKG=""
ACTIVE_PROF="default"
CURRENT_VALUE=0
SCREEN_ON=1

apply_default
echo "[THERMAL] Initial default applied"

# -------------------------
# MAIN LOOP
#
# Upstream is event-driven (TaskStackListener fires only on real focus
# changes; ACTION_SCREEN_ON/OFF re-applies the *same* mCurrentApp's
# profile rather than re-detecting it). Without a binder-level task
# listener available from shell, this still has to poll — but the screen
# on/off transition no longer wipes ACTIVE_PKG/CACHE_PKG, since upstream
# never forgets the current app on screen events, only re-applies its
# profile.
# -------------------------
while true; do

    # ---------- SCREEN OFF ----------
    if ! is_screen_on; then
        if [ "$SCREEN_ON" = "1" ]; then
            SCREEN_ON=0
            echo "[THERMAL] Screen OFF → default"
            apply_default
        fi
        sleep 2
        continue
    fi

    # ---------- SCREEN ON (transition) ----------
    if [ "$SCREEN_ON" = "0" ]; then
        SCREEN_ON=1
        echo "[THERMAL] Screen ON → restoring: $ACTIVE_PKG ($ACTIVE_PROF)"
        apply_for_profile "$ACTIVE_PROF"
    fi

    # ---------- FOREGROUND APP ----------
    FG_PKG=$(get_foreground_pkg)

    [ -z "$FG_PKG" ] && sleep 1 && continue

    is_system_overlay "$FG_PKG" && sleep 1 && continue

    [ "$FG_PKG" = "$ACTIVE_PKG" ] && sleep 1 && continue

    # New app — clear cache and classify
    CACHE_PKG=""
    PROFILE=$(classify_package "$FG_PKG")
    echo "[THERMAL] Foreground: $FG_PKG → $PROFILE (was: $ACTIVE_PKG -> $ACTIVE_PROF)"

    apply_for_profile "$PROFILE"

    ACTIVE_PKG="$FG_PKG"
    ACTIVE_PROF="$PROFILE"

    sleep 1
done
