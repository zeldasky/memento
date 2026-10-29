package io.github.zeldasky.memento;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 설정을 시스템 화면 보호기(MementoDream)와 나누는 작은 다리
        registerPlugin(MementoBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
