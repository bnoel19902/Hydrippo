package com.sidequeststudio.hydrippo

import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Shows the privacy policy that ships inside the app (www/privacy.html).
 * Health Connect opens this screen when someone taps "Read privacy policy" for Hydrippo.
 * The page has its own title, so there's no action bar; the system back gesture closes it.
 */
class PrivacyActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge() // same look on every Android version; bar icons follow light/dark mode
        super.onCreate(savedInstanceState)

        val web = WebView(this)
        web.setBackgroundColor(ContextCompat.getColor(this, R.color.hyd_bg))
        web.settings.javaScriptEnabled = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "file") return false
                // Links to other sites and email open outside the app.
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                } catch (e: ActivityNotFoundException) {
                    // Nothing can open it; stay put.
                }
                return true
            }
        }

        // Android 15+ draws apps edge to edge, so keep the page clear of the status and navigation bars.
        val frame = FrameLayout(this)
        frame.setBackgroundColor(ContextCompat.getColor(this, R.color.hyd_bg))
        frame.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        ViewCompat.setOnApplyWindowInsetsListener(frame) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(frame)
        web.loadUrl("file:///android_asset/public/privacy.html")
    }
}
