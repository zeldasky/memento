package io.github.zeldasky.memento;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 앱 화면(웹뷰)의 설정을 안드로이드 저장소에 적어 둔다.
 * 시스템 화면 보호기(MementoDream)는 앱 웹뷰와 저장소가 달라서, 여기 적힌 설정으로 같은 그림을 그린다.
 */
@CapacitorPlugin(name = "MementoBridge")
public class MementoBridgePlugin extends Plugin {
    static final String PREFS = "memento";
    static final String KEY_SETTINGS = "settings";

    @PluginMethod
    public void saveSettings(PluginCall call) {
        String json = call.getString("json", "");
        SharedPreferences p = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        p.edit().putString(KEY_SETTINGS, json).apply();
        call.resolve(new JSObject());
    }
}
