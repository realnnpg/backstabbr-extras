package com.backstabbr.extras

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.graphics.ColorUtils
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var container: FrameLayout
    private lateinit var web: WebView
    private val popups = ArrayList<WebView>()

    companion object {
        private const val START_URL = "https://www.backstabbr.com/"

        private val IN_APP_SUFFIXES = listOf(
            "backstabbr.com",
            "google.com",
            "gstatic.com",
            "googleapis.com",
            "googleusercontent.com",
            "firebaseapp.com"
        )

        private const val USE_DESKTOP_UA = false
        private const val DESKTOP_UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        container = FrameLayout(this)
        setContentView(container)

        web = WebView(this)
        configure(web)
        container.addView(
            web,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )

        web.addJavascriptInterface(StatusBarBridge(), "BSEAndroidBar")
        web.addJavascriptInterface(DownloadBridge(), "BSEAndroidDownload")

        Injector.registerDocumentStart(web)

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean = routeNavigation(request.url)

            override fun onPageFinished(view: WebView, url: String?) {
                if (url != null) Injector.injectForPage(view, url)
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message
            ): Boolean {
                spawnPopup(resultMsg)
                return true
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    popups.isNotEmpty() -> closePopup(popups.last())
                    web.canGoBack() -> web.goBack()
                    else -> {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        })

        if (savedInstanceState == null) web.loadUrl(START_URL)
        else web.restoreState(savedInstanceState)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configure(w: WebView) {
        with(w.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = true
            displayZoomControls = false
            setSupportZoom(true)
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            mediaPlaybackRequiresUserGesture = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString =
                if (USE_DESKTOP_UA) DESKTOP_UA else (userAgentString ?: "").replace("; wv", "")
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(w, true)
        }
    }

    private fun spawnPopup(resultMsg: Message) {
        val child = WebView(this)
        configure(child)

        child.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean = routeNavigation(request.url)

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                if (url == null || url == "about:blank") return
                val host = Uri.parse(url).host ?: return
                if (!keepInApp(host)) {
                    openExternally(Uri.parse(url))
                    view.stopLoading()
                    closePopup(view)
                }
            }
        }

        child.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message
            ): Boolean {
                spawnPopup(resultMsg)
                return true
            }

            override fun onCloseWindow(window: WebView) {
                closePopup(window)
            }
        }

        container.addView(
            child,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        popups.add(child)

        val transport = resultMsg.obj as WebView.WebViewTransport
        transport.webView = child
        resultMsg.sendToTarget()
    }

    private fun closePopup(w: WebView) {
        if (!popups.remove(w)) return
        container.post {
            try {
                container.removeView(w)
                w.destroy()
            } catch (e: Exception) {
            }
        }
    }

    private fun routeNavigation(url: Uri): Boolean {
        val scheme = url.scheme?.lowercase()
        if (scheme != "http" && scheme != "https") {
            openExternally(url)
            return true
        }
        val host = url.host ?: return false
        if (keepInApp(host)) return false
        openExternally(url)
        return true
    }

    private fun openExternally(url: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url))
        } catch (e: Exception) {
        }
    }

    private fun keepInApp(host: String): Boolean =
        IN_APP_SUFFIXES.any { host == it || host.endsWith(".$it") }

    inner class StatusBarBridge {
        @JavascriptInterface
        fun setColor(hex: String) {
            runOnUiThread {
                try {
                    val c = Color.parseColor(hex.trim())
                    window.statusBarColor = c
                    val light = ColorUtils.calculateLuminance(c) > 0.5
                    WindowInsetsControllerCompat(window, window.decorView)
                        .isAppearanceLightStatusBars = light
                } catch (e: Exception) {
                }
            }
        }
    }

    inner class DownloadBridge {
        @JavascriptInterface
        fun save(dataUrl: String, filename: String, mime: String) {
            saveDataUrl(dataUrl, filename, mime)
        }

        @JavascriptInterface
        fun error(filename: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Export failed: $filename", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun saveDataUrl(dataUrl: String, filename: String, mimeIn: String) {
        Thread {
            try {
                val comma = dataUrl.indexOf(',')
                val meta = if (comma >= 0) dataUrl.substring(0, comma) else ""
                val b64 = if (comma >= 0) dataUrl.substring(comma + 1) else dataUrl
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                val mime = when {
                    mimeIn.isNotBlank() -> mimeIn
                    meta.contains("application/pdf") -> "application/pdf"
                    meta.contains("text/html") -> "text/html"
                    else -> "application/octet-stream"
                }
                val safe = sanitizeName(filename)
                val uri = writeDownload(safe, mime, bytes)
                runOnUiThread {
                    if (uri != null) {
                        Toast.makeText(this, "Saved: $safe", Toast.LENGTH_LONG).show()
                        openSaved(uri, mime)
                    } else {
                        Toast.makeText(this, "Export failed", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this, "Export failed", Toast.LENGTH_SHORT).show() }
            }
        }.start()
    }

    private fun writeDownload(filename: String, mime: String, bytes: ByteArray): Uri? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val cv = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, filename)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv) ?: return null
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
            cv.clear()
            cv.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, cv, null, null)
            return uri
        }
        val dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
        if (!dir.exists()) dir.mkdirs()
        val f = File(dir, filename)
        FileOutputStream(f).use { it.write(bytes) }
        return FileProvider.getUriForFile(this, "$packageName.fileprovider", f)
    }

    private fun openSaved(uri: Uri, mime: String) {
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, mime)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            )
        } catch (e: Exception) {
            Toast.makeText(this, "Saved to Downloads.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun sanitizeName(name: String): String {
        val cleaned = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
        return if (cleaned.isEmpty()) "backstabbr-export" else cleaned
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
