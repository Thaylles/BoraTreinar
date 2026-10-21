package com.boratreinar.app

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Length
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.Instant

/**
 * Sincroniza o BoraTreinar com o Health Connect.
 * Aberta pelo site (boratreinar://sync?api=…&token=…): guarda o token, pede as permissões,
 * envia as atividades do celular para o BoraTreinar e grava os treinos do BoraTreinar no
 * Health Connect (de onde o GymRats e outros apps leem).
 */
class HealthSyncActivity : ComponentActivity() {

    private lateinit var status: TextView
    private lateinit var progress: ProgressBar
    private lateinit var back: Button

    private val prefs by lazy { getSharedPreferences("health_connect", MODE_PRIVATE) }

    private val permissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(DistanceRecord::class),
    )

    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract() as ActivityResultContract<Set<String>, Set<String>>,
    ) { granted ->
        if (granted.containsAll(permissions)) startSync()
        else done("Sem permissão do Health Connect. Toque em Sincronizar de novo e permita o acesso aos exercícios.")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        handle(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent?) {
        intent?.data?.let { uri ->
            uri.getQueryParameter("api")?.takeIf { it.startsWith("https://") }?.let { prefs.edit().putString("api", it.trimEnd('/')).apply() }
            uri.getQueryParameter("token")?.takeIf { it.length in 20..100 }?.let { prefs.edit().putString("token", it).remove("since").apply() }
        }
        if (prefs.getString("token", null) == null || prefs.getString("api", null) == null) {
            done("Conecte primeiro pelo BoraTreinar: Perfil → Health Connect → Conectar.")
            return
        }
        when (HealthConnectClient.getSdkStatus(this)) {
            HealthConnectClient.SDK_UNAVAILABLE ->
                done("Este celular não tem o Health Connect (precisa de Android 9 ou mais novo).")
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                done("Instale ou atualize o Health Connect na Play Store e volte aqui.")
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"))
                        .setPackage("com.android.vending"),
                )
            }
            else -> lifecycleScope.launch {
                val client = HealthConnectClient.getOrCreate(this@HealthSyncActivity)
                if (client.permissionController.getGrantedPermissions().containsAll(permissions)) startSync()
                else requestPermissions.launch(permissions)
            }
        }
    }

    private fun startSync() {
        working("Lendo suas atividades do Health Connect…")
        lifecycleScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(this@HealthSyncActivity)
                val now = Instant.now()
                // Primeira vez: 30 dias. Depois: desde a última sincronização, com 2 dias de folga.
                val since = Instant.ofEpochMilli(prefs.getLong("since", now.minus(Duration.ofDays(30)).toEpochMilli()))
                val items = readActivities(client, since, now)

                working("Enviando ${items.length()} atividade(s) para o BoraTreinar…")
                val response = post(JSONObject().put("items", items))
                val export = response.optJSONArray("export") ?: JSONArray()

                working("Gravando seus treinos no Health Connect…")
                val written = writeWorkouts(client, export)
                prefs.edit().putLong("since", now.minus(Duration.ofDays(2)).toEpochMilli()).apply()
                done(
                    "Pronto! ✅\n\n${response.optInt("imported")} atividade(s) nova(s) no BoraTreinar.\n" +
                        "$written treino(s) do BoraTreinar no Health Connect (o GymRats lê de lá).",
                )
            } catch (e: Unauthorized) {
                prefs.edit().remove("token").apply()
                done("A conexão expirou. Conecte de novo pelo BoraTreinar: Perfil → Health Connect.")
            } catch (e: Exception) {
                done("Não deu para sincronizar: ${e.message ?: "erro"}. Confira a internet e tente de novo.")
            }
        }
    }

    /** Atividades de outros apps (as do próprio BoraTreinar são ignoradas para não duplicar). */
    private suspend fun readActivities(client: HealthConnectClient, since: Instant, until: Instant): JSONArray {
        val out = JSONArray()
        var pageToken: String? = null
        do {
            val page = client.readRecords(
                ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.between(since, until), pageSize = 200, pageToken = pageToken),
            )
            for (s in page.records) {
                val origin = s.metadata.dataOrigin.packageName
                if (origin == packageName) continue
                val meters = runCatching {
                    client.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), TimeRangeFilter.between(s.startTime, s.endTime)))[
                        DistanceRecord.DISTANCE_TOTAL
                    ]?.inMeters
                }.getOrNull()
                out.put(
                    JSONObject()
                        .put("id", s.metadata.id)
                        .put("category", category(s.exerciseType))
                        .put("start", s.startTime.toString())
                        .put("end", s.endTime.toString())
                        .put("distance_m", meters ?: JSONObject.NULL)
                        .put("title", s.title ?: JSONObject.NULL)
                        .put("origin", appName(origin)),
                )
            }
            pageToken = page.pageToken
        } while (pageToken != null && out.length() < 300)
        return out
    }

    /** Treinos do BoraTreinar → Health Connect (o mesmo id atualiza em vez de duplicar). */
    private suspend fun writeWorkouts(client: HealthConnectClient, export: JSONArray): Int {
        val records = mutableListOf<Record>()
        for (i in 0 until export.length()) {
            val w = export.getJSONObject(i)
            val id = w.getString("id")
            val start = Instant.parse(w.getString("start"))
            val end = Instant.parse(w.getString("end"))
            records += ExerciseSessionRecord(
                startTime = start,
                startZoneOffset = null,
                endTime = end,
                endZoneOffset = null,
                metadata = Metadata.manualEntry(clientRecordId = "bt-$id", clientRecordVersion = 1),
                exerciseType = exerciseType(w.getString("category")),
                title = w.optString("title").ifBlank { null },
                notes = "Registrado no BoraTreinar",
            )
            val meters = w.optDouble("distance_m", 0.0)
            if (meters > 0) {
                records += DistanceRecord(
                    startTime = start,
                    startZoneOffset = null,
                    endTime = end,
                    endZoneOffset = null,
                    distance = Length.meters(meters),
                    metadata = Metadata.manualEntry(clientRecordId = "bt-d-$id", clientRecordVersion = 1),
                )
            }
        }
        if (records.isNotEmpty()) client.insertRecords(records)
        return export.length()
    }

    private class Unauthorized : Exception()

    private suspend fun post(body: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val conn = URL("${prefs.getString("api", "")}/api/saude/sincronizar").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15_000
            conn.readTimeout = 60_000
            conn.doOutput = true
            conn.setRequestProperty("content-type", "application/json")
            conn.setRequestProperty("authorization", "Bearer ${prefs.getString("token", "")}")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            if (conn.responseCode == 401) throw Unauthorized()
            val text = (if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
            val json = JSONObject(text)
            if (conn.responseCode !in 200..299) throw Exception(json.optString("error", "HTTP ${conn.responseCode}"))
            json
        } finally {
            conn.disconnect()
        }
    }

    private fun category(type: Int): String = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "corrida"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "esteira"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING, ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "caminhada"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "bike"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "bike_ergometrica"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "eliptico"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "natacao"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE, ExerciseSessionRecord.EXERCISE_TYPE_ROWING -> "remo"
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING, ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE -> "escada"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
        ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "musculacao"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_DANCING,
        ExerciseSessionRecord.EXERCISE_TYPE_BOXING, ExerciseSessionRecord.EXERCISE_TYPE_MARTIAL_ARTS,
        ExerciseSessionRecord.EXERCISE_TYPE_SOCCER, ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL,
        ExerciseSessionRecord.EXERCISE_TYPE_VOLLEYBALL, ExerciseSessionRecord.EXERCISE_TYPE_TENNIS -> "outro_cardio"
        else -> "outro"
    }

    private fun exerciseType(category: String): Int = when (category) {
        "corrida" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING
        "esteira" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL
        "caminhada" -> ExerciseSessionRecord.EXERCISE_TYPE_WALKING
        "bike" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING
        "bike_ergometrica" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        "eliptico" -> ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL
        "natacao" -> ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL
        "remo" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE
        "escada" -> ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE
        "musculacao" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
    }

    private fun appName(pkg: String): String = when (pkg) {
        "com.sec.android.app.shealth" -> "Samsung Health"
        "com.google.android.apps.fitness" -> "Google Fit"
        "com.fitbit.FitbitMobile" -> "Fitbit"
        "com.garmin.android.apps.connectmobile" -> "Garmin Connect"
        "com.strava" -> "Strava"
        "com.xiaomi.wearable", "com.mi.health" -> "Mi Fitness"
        "com.huami.watch.hmwatchmanager" -> "Zepp"
        else -> runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }
            .getOrDefault("Health Connect")
    }

    // ─── Tela simples (sem bibliotecas de UI) ───────────────────────

    private fun buildUi() {
        val pad = (24 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(pad, pad, pad, pad)
            setBackgroundColor(Color.parseColor("#FFF8E7"))
        }
        root.addView(TextView(this).apply {
            text = "BoraTreinar ❤️ Health Connect"
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#002776"))
            gravity = Gravity.CENTER
        })
        progress = ProgressBar(this).apply { isIndeterminate = true }
        root.addView(progress, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = pad
        })
        status = TextView(this).apply {
            textSize = 16f
            setTextColor(Color.parseColor("#1F2937"))
            gravity = Gravity.CENTER
        }
        root.addView(status, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = pad
        })
        back = Button(this).apply {
            text = "Voltar ao BoraTreinar"
            visibility = View.GONE
            setOnClickListener {
                startActivity(Intent(this@HealthSyncActivity, LauncherActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                finish()
            }
        }
        root.addView(back, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = pad
        })
        setContentView(root)
    }

    private fun working(message: String) {
        status.text = message
        progress.visibility = View.VISIBLE
        back.visibility = View.GONE
    }

    private fun done(message: String) {
        status.text = message
        progress.visibility = View.GONE
        back.visibility = View.VISIBLE
    }
}
