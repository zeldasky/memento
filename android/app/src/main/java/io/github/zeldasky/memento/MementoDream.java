package io.github.zeldasky.memento;

import android.content.Context;
import android.service.dreams.DreamService;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * 시스템 화면 보호기(안드로이드 Dream) — 폰이 충전 중 · 거치대에서 쉬면 시스템이 켠다.
 * 폰 설정 → 디스플레이 → 화면 보호기 → 메멘토. 앱을 열어 두지 않아도 된다.
 * 앱과 같은 그림 코드(assets/public)를 ?dream=1 로 띄우면, 글 · 단추 없이 번인 막는 보호기 모양으로만 그린다.
 * 만지면 시스템이 보호기를 끈다(interactive=false).
 */
public class MementoDream extends DreamService {
    private WebView web;

    /** 웹 쪽에서 window.MementoNative.settings() 로 앱 설정(JSON)을 읽는다 */
    public class Native {
        @JavascriptInterface
        public String settings() {
            return getSharedPreferences(MementoBridgePlugin.PREFS, Context.MODE_PRIVATE)
                .getString(MementoBridgePlugin.KEY_SETTINGS, "");
        }
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);   // 손대면 바로 끈다
        setFullscreen(true);
        setScreenBright(false);  // 시스템이 화면을 어둡게(번인 · 전력)

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setBackgroundColor(0xFF000000);
        web.addJavascriptInterface(new Native(), "MementoNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });
        web.loadUrl("https://appassets.androidplatform.net/assets/public/index.html?dream=1");
        setContentView(web);
    }

    @Override
    public void onDetachedFromWindow() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDetachedFromWindow();
    }
}
