#!/system/bin/sh

SKIPMOUNT=false
PROPFILE=true
POSTFSDATA=true
LATESTARTSERVICE=true

REPLACE="
"

MODDIR=${0%/*}

ui_print " "
ui_print "⊳ Setting up T-ENGINE..."
ui_print " "

# Create log directory
mkdir -p /data/local/tmp/t-engine
chmod 755 /data/local/tmp/t-engine

# Create thermal control file if not exists
if [ ! -f /data/system/thermal_control.xml ]; then
    cat > /data/system/thermal_control.xml << 'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="thermal_control">thermal.benchmark=:thermal.browser=:thermal.camera=:thermal.dialer=:thermal.gaming=hok,com.garena.game.codm,hok_oversea,GP,com.netease.allstar,com.netease.h75na,Infinity_Nikki,NARAKA_BLADEPOINT,JusticeOnline,Seasun_JXOnline3,Tencent_DFM,Tencent_PRacing,WutheringWaves,com.kurogame.wutheringwaves.global,PerfectWorld_P5X,Netease_Diablo,Racing_Master,Tarisland,Arena_Breakout,Tencent_DNF,Tencent_LOL,Tencent_Spatula,com.miHoYo.GenshinImpact,StarRail,ZenlessZoneZero,com.pubg.imobile,com.tencent.ig,CarX_Street,com.garena.game.df,com.MadOut.BIG,com.mobile.legends,:thermal.streaming=</string>
</map>
EOF
    chmod 644 /data/system/thermal_control.xml
fi

ui_print "⊳ T-ENGINE configured successfully!"
