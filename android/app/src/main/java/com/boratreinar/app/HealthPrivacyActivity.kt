package com.boratreinar.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/** Exigida pelo Health Connect: mostra como o BoraTreinar usa os dados de saúde (termos e privacidade). */
class HealthPrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://${getString(R.string.hostName)}/termos")))
        finish()
    }
}
