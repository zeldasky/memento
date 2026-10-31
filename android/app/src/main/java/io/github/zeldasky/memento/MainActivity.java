package io.github.zeldasky.memento;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 설정을 시스템 화면 보호기(MementoDream)와 나누는 작은 다리
        registerPlugin(MementoBridgePlugin.class);
        // 폰 안 AI 플러그인은 시험판 빌드(src/debug)에만 있다
        try {
            registerPlugin(Class.forName("io.github.zeldasky.memento.MementoAiPlugin").asSubclass(Plugin.class));
        } catch (ClassNotFoundException ignored) {
        }
        super.onCreate(savedInstanceState);
    }
}
