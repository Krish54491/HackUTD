package com.tango.app.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

/** App-private flagged-message history. Demo data is never written into this store. */
class MessageRepository private constructor(context: Context) {
    private val preferences = context.getSharedPreferences("live_message_history", Context.MODE_PRIVATE)
    private val mutex = Mutex()
    private var loaded = false
    private val _records = MutableStateFlow<List<MessageRecord>>(emptyList())
    val records = _records.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    init { CoroutineScope(SupervisorJob() + Dispatchers.IO).launch { mutex.withLock { loadLocked() } } }

    private fun loadLocked() {
        if (loaded) return
        try {
            val array = JSONArray(preferences.getString("records", "[]") ?: "[]")
            _records.value = (0 until array.length()).map { decode(array.getJSONObject(it)) }.filterNot { it.isDemo }
        } catch (_: Exception) { _error.value = "Saved message history could not be read." }
        loaded = true; _loading.value = false
    }
    private fun saveLocked(rows: List<MessageRecord>) {
        val trimmed = rows.sortedByDescending { it.receivedAt }.take(200)
        val json = JSONArray().apply { trimmed.forEach { put(encode(it)) } }.toString()
        if (!preferences.edit().putString("records", json).commit()) throw IllegalStateException("Message history could not be saved.")
        _records.value = trimmed; _error.value = null
    }
    suspend fun insertIfAbsent(record: MessageRecord): Boolean = mutex.withLock {
        loadLocked()
        if (_records.value.any { it.id == record.id }) false
        else { saveLocked(listOf(record) + _records.value); true }
    }
    suspend fun update(id: String, transform: (MessageRecord) -> MessageRecord): MessageRecord? = mutex.withLock {
        loadLocked()
        val existing = _records.value.firstOrNull { it.id == id } ?: return@withLock null
        val updated = transform(existing)
        saveLocked(_records.value.map { if (it.id == id) updated else it })
        updated
    }
    suspend fun clear() = mutex.withLock { loadLocked(); saveLocked(emptyList()) }

    private fun encode(row: MessageRecord) = JSONObject().apply {
        put("id", row.id); put("title", row.title); put("domain", row.domain ?: JSONObject.NULL)
        put("time", row.time); put("category", row.category); put("sender", row.sender); put("preview", row.preview)
        put("tags", JSONArray(row.tags)); put("clues", JSONArray().apply { row.clues.forEach { put(JSONObject().put("title", it.title).put("detail", it.detail)) } })
        put("adviceTitle", row.adviceTitle); put("advice", row.advice); put("corrected", row.corrected)
        put("risk", row.risk.name); put("receivedAt", row.receivedAt); put("sourcePackage", row.sourcePackage)
        put("url", row.url ?: JSONObject.NULL); put("warningPosted", row.warningPosted)
        put("dismissalRequested", row.dismissalRequested); put("originalAlertHidden", row.originalAlertHidden)
    }
    private fun decode(value: JSONObject): MessageRecord {
        val tags = value.optJSONArray("tags") ?: JSONArray()
        val clues = value.optJSONArray("clues") ?: JSONArray()
        return MessageRecord(
            id = value.getString("id"), title = value.getString("title"), domain = value.optString("domain").takeUnless { it.isBlank() || it == "null" },
            time = value.getString("time"), category = value.getString("category"), sender = value.getString("sender"), preview = value.getString("preview"),
            tags = (0 until tags.length()).map { tags.getString(it) },
            clues = (0 until clues.length()).map { clues.getJSONObject(it).let { item -> Clue(item.getString("title"), item.getString("detail")) } },
            adviceTitle = value.getString("adviceTitle"), advice = value.getString("advice"), corrected = value.optBoolean("corrected"),
            risk = runCatching { MessageRisk.valueOf(value.getString("risk")) }.getOrDefault(MessageRisk.MEDIUM), isDemo = false,
            receivedAt = value.getLong("receivedAt"), sourcePackage = value.optString("sourcePackage"),
            url = value.optString("url").takeUnless { it.isBlank() || it == "null" }, warningPosted = value.optBoolean("warningPosted"),
            dismissalRequested = value.optBoolean("dismissalRequested"), originalAlertHidden = value.optBoolean("originalAlertHidden"),
        )
    }
    companion object {
        @Volatile private var instance: MessageRepository? = null
        fun get(context: Context): MessageRepository = instance ?: synchronized(this) {
            instance ?: MessageRepository(context.applicationContext).also { instance = it }
        }
    }
}
