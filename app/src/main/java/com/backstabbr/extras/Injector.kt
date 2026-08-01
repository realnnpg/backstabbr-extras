package com.backstabbr.extras

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

object Injector {

    private val ORIGINS = setOf("https://backstabbr.com", "https://www.backstabbr.com")
    private val cache = HashMap<String, String>()

    private fun asset(ctx: Context, path: String): String =
        cache.getOrPut(path) {
            ctx.assets.open(path).bufferedReader().use { it.readText() }
        }

    private fun js(ctx: Context, name: String) = asset(ctx, "bse/$name")
    private fun loader(ctx: Context, name: String) = asset(ctx, "loader/$name")

    private fun cssInject(ctx: Context, name: String): String {
        val css = asset(ctx, "bse/$name")
        val b64 = Base64.encodeToString(css.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        return "(function(){try{" +
            "if(document.querySelector('style[data-bse=\"$name\"]'))return;" +
            "var s=document.createElement('style');s.setAttribute('data-bse','$name');" +
            "s.textContent=decodeURIComponent(escape(atob('$b64')));" +
            "(document.head||document.documentElement).appendChild(s);" +
            "}catch(e){}})();"
    }

    private fun appVersion(ctx: Context): String = try {
        ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "1.0"
    } catch (e: Exception) {
        "1.0"
    }

    private fun shim(ctx: Context): String =
        loader(ctx, "shim.js").replace("__BSE_VERSION__", appVersion(ctx))

    private fun documentStartScripts(ctx: Context): List<String> = listOf(
        shim(ctx),
        cssInject(ctx, "theme.css"),
        js(ctx, "theme.js"),
        js(ctx, "board-bridge.js"),
        js(ctx, "board-bus.js"),
        js(ctx, "history.js")
    )

    fun registerDocumentStart(web: WebView) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        val ctx = web.context
        documentStartScripts(ctx).forEach {
            WebViewCompat.addDocumentStartJavaScript(web, it, ORIGINS)
        }
    }

    fun injectForPage(web: WebView, url: String) {
        val ctx = web.context
        val uri = Uri.parse(url)
        val host = uri.host ?: return
        if (host != "backstabbr.com" && host != "www.backstabbr.com") return
        val path = uri.path ?: "/"

        val batch = ArrayList<String>()

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            batch.addAll(documentStartScripts(ctx))
        }

        batch.add(js(ctx, "troll.js"))
        batch.add(loader(ctx, "mobile.js"))
        batch.add(loader(ctx, "overlay.js"))
        batch.add(loader(ctx, "download.js"))

        if (path.startsWith("/member/")) {
            batch.add(cssInject(ctx, "styles.css"))
            batch.add(js(ctx, "content.js"))
        }

        if (path.startsWith("/game/") || path.startsWith("/sandbox/")) {
            batch.add(cssInject(ctx, "board.css"))
            batch.add(js(ctx, "board-map.js"))
            batch.add(js(ctx, "board.js"))
        }

        if (path.startsWith("/game/")) {
            batch.add(cssInject(ctx, "press.css"))
            batch.add(js(ctx, "press.js"))
            batch.add(js(ctx, "autosave.js"))
            batch.add(js(ctx, "drafts.js"))
            batch.add(cssInject(ctx, "stats.css"))
            batch.add(js(ctx, "stats.js"))
        }

        val probe =
            "(function(){if(window.__bsePageInjected)return true;window.__bsePageInjected=true;return false;})()"
        web.evaluateJavascript(probe) { r ->
            if (r == "false") batch.forEach { web.evaluateJavascript(it, null) }
        }
    }
}
