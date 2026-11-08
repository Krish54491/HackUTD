package com.tango.app.data

import android.content.Context
import com.tango.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

/** Ids must match REPORT_CATEGORIES in backend/spacetime/src/lib.ts. */
enum class ReportCategory(val id: String, val label: String) {
    Phishing("phishing", "Phishing / fake login"),
    Shopping("shopping", "Fake store"),
    Job("job", "Fake job"),
    Scholarship("scholarship", "Fake scholarship"),
    Impersonation("impersonation", "Impersonation"),
    Other("other", "Something else"),
}

const val MAX_REPORT_NOTE = 280

data class CommunityFlag(val domain: String, val reports: Int)

class ReportException(message: String) : Exception(message)

fun reportsLabel(n: Int) = if (n == 1) "1 person has" else "$n people have"

/** Same rules as normalizeDomain in the extension and website: bare lowercase host, no "www.". */
fun normalizeDomain(input: String): String? {
    val raw = input.trim()
    if (raw.isEmpty()) return null
    val uri = try { URI(if ("://" in raw) raw else "https://$raw") } catch (_: Exception) { return null }
    if (uri.scheme?.lowercase() !in setOf("http", "https") || uri.userInfo != null) return null
    val host = uri.host?.lowercase()?.removePrefix("www.") ?: return null
    return host.takeIf { '.' in it && it.all { c -> c.isLetterOrDigit() || c == '.' || c == '-' } }
}

/**
 * Sends "Report a hornet" reports to the same SpacetimeDB database as the website and browser extension.
 * Only the domain, category and optional note leave the phone; message text and senders never do.
 */
class HornetNest(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("hornet_nest", Context.MODE_PRIVATE)
    private val host = BuildConfig.SPACETIME_HOST.trimEnd('/')
    private val db = BuildConfig.SPACETIME_DB

    suspend fun report(input: String, category: ReportCategory, note: String): CommunityFlag = withContext(Dispatchers.IO) {
        val domain = normalizeDomain(input) ?: throw ReportException("Enter a website name like example.com")
        val args = JSONArray().put(domain).put(category.id).put(note.trim().take(MAX_REPORT_NOTE)).toString()
        val path = "/v1/database/$db/call/report_site"
        val res = try {
            post(path, args, "application/json", token()).let {
                // A stored token from an older server is rejected; mint a fresh identity once.
                if (it.code == 401) post(path, args, "application/json", token(fresh = true)) else it
            }
        } catch (_: IOException) {
            throw ReportException("Unable to reach Tango. Check your connection and try again.")
        }
        when {
            res.code in 200..299 -> Unit
            res.code == 404 -> throw ReportException("Reporting isn't switched on for this Tango server yet. Please try again later.")
            // SpacetimeDB answers a reducer's SenderError (bad input, daily limit) with HTTP 530.
            res.code < 500 || res.code == 530 -> throw ReportException(res.body.trim().ifEmpty { "Tango could not accept that report." })
            else -> throw ReportException("Tango is having trouble right now. Please try again later.")
        }
        communityFlag(domain) ?: CommunityFlag(domain, 1)
    }

    /** Public per-site totals. Never throws: no data, an old server or a network error all mean "no flag". */
    suspend fun communityFlag(domain: String): CommunityFlag? = withContext(Dispatchers.IO) {
        try {
            val res = post("/v1/database/$db/sql", "SELECT * FROM community_flag WHERE domain = '${domain.replace("'", "''")}'", "text/plain", token())
            if (res.code !in 200..299) return@withContext null
            val result = JSONArray(res.body).optJSONObject(0) ?: return@withContext null
            val columns = result.getJSONObject("schema").getJSONArray("elements").let { elements ->
                List(elements.length()) { i -> columnName(elements.getJSONObject(i).opt("name")) }
            }
            val row = result.getJSONArray("rows").optJSONArray(0) ?: return@withContext null
            CommunityFlag(domain, row.getInt(columns.indexOf("reports")))
        } catch (_: Exception) {
            null
        }
    }

    private fun columnName(name: Any?): String? = when (name) {
        is String -> name
        is JSONObject -> name.optString("some").ifEmpty { null }
        else -> null
    }

    private fun token(fresh: Boolean = false): String {
        if (!fresh) prefs.getString(TOKEN_KEY, null)?.let { return it }
        val res = post("/v1/identity", null, null, null)
        if (res.code !in 200..299) throw IOException("identity: HTTP ${res.code}")
        return JSONObject(res.body).getString("token").also { prefs.edit().putString(TOKEN_KEY, it).apply() }
    }

    private class Response(val code: Int, val body: String)

    private fun post(path: String, body: String?, contentType: String?, token: String?): Response {
        val conn = URL(host + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            token?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                conn.doOutput = true
                contentType?.let { conn.setRequestProperty("Content-Type", it) }
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            return Response(code, stream?.bufferedReader()?.use { it.readText() } ?: "")
        } finally {
            conn.disconnect()
        }
    }

    private companion object {
        const val TOKEN_KEY = "reporter_token"
    }
}
